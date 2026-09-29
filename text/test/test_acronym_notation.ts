import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { DETECTORS } from "../packages/chaff/src/detectors/index.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { Lexicon, LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// 数字の隣でだけ略語から外す語（meridiem、time-zone、currency-code、us-state-code）と、単独で強調の語（emphasis-word）。
// 語彙表のどの語も、それぞれの書き方の中で外れ、書き方の外では数えられ、語彙表から抜けば書き方の中でも数えられる。例文はすべて自作。

const reported = (adapter: LanguageAdapter, source: string): string[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(adapter.id), { "undefined-acronym": "strict" }, true, "business/report")
    .findings.filter((finding) => finding.rule === "undefined-acronym")
    .map((finding) => String(finding.values["word"]));

const listOf = (adapter: LanguageAdapter, id: string): string[] => (adapter.lexicons[id] ?? []).map((entry) => entry.pattern);

const without = (adapter: LanguageAdapter, id: string, word: string): LanguageAdapter => ({
  ...adapter,
  lexicons: { ...adapter.lexicons, [id]: (adapter.lexicons[id] ?? []).filter((entry) => entry.pattern !== word) },
});

/** 語を文に置く。どの文にも説明の無い略語 SRE を並べ、rule が動いていることを毎回確かめる。 */
const sentence = (adapter: LanguageAdapter, phrase: string): string =>
  adapter.id === "ja" ? `# 手引き\n\n連絡は ${phrase} で受けます。SREも見ます。\n` : `# Notes\n\nWe meet at ${phrase} today. The SRE joins.\n`;

type Notation = { readonly inside: readonly ((word: string) => string)[]; readonly outside?: (word: string) => string };

/** 語彙表ごとに、語が外れる書き方と、同じ語が数えられる書き方。強調の語は単独でも外れるので、外は無い。 */
const NOTATIONS: Record<string, Notation> = {
  meridiem: { inside: [(word) => `3:30 ${word}`, (word) => `10${word}`], outside: (word) => `the ${word} desk` },
  "time-zone": { inside: [(word) => `16:00 ${word}`, (word) => `2pm ${word}`, (word) => `12:30pm ${word}`], outside: (word) => `the ${word} desk` },
  "currency-code": { inside: [(word) => `${word} 1,000,000`, (word) => `250 ${word}`, (word) => `${word} $1,000`], outside: (word) => `the ${word} desk` },
  "us-state-code": {
    inside: [(word) => `Kansas City, ${word} 64108`, (word) => `Berkeley, ${word} 94720-1234`],
    outside: (word) => `the ${word} 94720 office`,
  },
  "emphasis-word": { inside: [(word) => `the desk, ${word} the hall`] },
};

const commonOf = (adapter: LanguageAdapter): Set<string> => new Set(listOf(adapter, "common-acronym"));

const assertInside = (adapter: LanguageAdapter, id: string, notation: Notation): void =>
  listOf(adapter, id)
    .flatMap((word) => notation.inside.map((place) => place(word)))
    .forEach((phrase) => assert.deepEqual(reported(adapter, sentence(adapter, phrase)), ["SRE"], phrase));

const assertOutside = (adapter: LanguageAdapter, id: string, outside: (word: string) => string): void =>
  listOf(adapter, id).forEach((word) => {
    const expected = commonOf(adapter).has(word) ? ["SRE"] : [word, "SRE"];
    assert.deepEqual(reported(adapter, sentence(adapter, outside(word))), expected, outside(word));
  });

const assertDropped = (adapter: LanguageAdapter, id: string, place: (word: string) => string): void =>
  listOf(adapter, id)
    .filter((word) => !commonOf(adapter).has(word))
    .forEach((word) => assert.deepEqual(reported(without(adapter, id, word), sentence(adapter, place(word))), [word, "SRE"], place(word)));

const SUITES = [en, ja].flatMap((adapter) => Object.entries(NOTATIONS).map(([id, notation]) => ({ adapter, id, notation })));

SUITES.forEach(({ adapter, id, notation }) => {
  describe(`${id}（${adapter.id}）`, () => {
    it("語彙表があり、語は大文字だけ", () => {
      const words = listOf(adapter, id);
      assert.ok(words.length > 0);
      assert.deepEqual(
        words.filter((word) => !/^[A-Z]+$/u.test(word)),
        [],
      );
    });

    it("どの語も書き方の中では数えず、SRE は数える", () => assertInside(adapter, id, notation));

    const { outside } = notation;
    if (outside !== undefined) it("書き方の外では、通じる略語でなければ数える", () => assertOutside(adapter, id, outside));

    const [first] = notation.inside;
    if (first !== undefined) it("語彙表から抜いた語は、書き方の中でも数える", () => assertDropped(adapter, id, first));
  });
});

/** 語彙表の YAML に書いた語の数。 */
const writtenEntries = (path: string): { readonly id: string; readonly count: number } => {
  const raw: unknown = parse(readFileSync(path, "utf8"));
  if (typeof raw !== "object" || raw === null) return { id: path, count: 0 };
  const count = "entries" in raw && Array.isArray(raw.entries) ? raw.entries.length : 0;
  return { id: "id" in raw ? String(raw.id) : path, count };
};

const lexiconFiles = (adapter: LanguageAdapter): string[] => {
  const dir = join(import.meta.dirname, "..", "packages", `lang-${adapter.id}`, "lexicons");
  return readdirSync(dir)
    .filter((file) => file.endsWith(".yaml"))
    .map((file) => join(dir, file));
};

const LEXICON_FILES = [en, ja].flatMap((adapter) => lexiconFiles(adapter).map((path) => ({ adapter, path })));

describe("語彙表の読み込みで語が落ちない", () => {
  // 引用符の無い NULL や 1e3 は文字列でなく読まれ、語彙表から黙って消える。書いた語の数だけ読まれることを見る。
  LEXICON_FILES.forEach(({ adapter, path }) => {
    it(`${adapter.id}/${path.split("/").at(-1) ?? path}`, () => {
      const { id, count } = writtenEntries(path);
      assert.equal((adapter.lexicons[id] ?? []).length, count);
    });
  });
});

const byName = (left: string, right: string): number => left.localeCompare(right, "en");

/** detector が doc.lexicons から実際に引いた語彙表の名前。 */
const listsRead = (adapter: LanguageAdapter, ruleId: string): string[] => {
  const doc = buildDocument("t.md", sentence(adapter, "3:30 PM"), adapter);
  const read = new Set<string>();
  const lexicons = new Proxy<Record<string, Lexicon>>(doc.lexicons, {
    get: (target, key) => {
      if (typeof key === "string") read.add(key);
      return typeof key === "string" ? target[key] : undefined;
    },
  });
  DETECTORS[ruleId]?.({ ...doc, lexicons }, { limit: 1, lexicon: doc.lexicons["common-acronym"] });
  return [...read].sort(byName);
};

describe("undefined-acronym は読む語彙表をすべて宣言する", () => {
  [en, ja].forEach((adapter) => {
    it(`${adapter.id}: 宣言した語彙表と、detector が読む語彙表が一致する`, () => {
      const rule = loadRules(adapter.id).find((candidate) => candidate.id === "undefined-acronym");
      assert.deepEqual(listsRead(adapter, "undefined-acronym"), [...(rule?.extra_word_lists ?? [])].sort(byName));
    });
  });
});
