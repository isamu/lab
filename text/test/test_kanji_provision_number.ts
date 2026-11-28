import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { trailingOrdinals } from "../packages/chaff/src/detectors/counter-edge.ts";
import type { Token } from "../packages/chaff/src/plugin.ts";
import { measuredOffOn } from "../scripts/rules-measure-files.ts";

// max-kanji-continuous: 法令の名前の後ろの条や項の番号（学校教育法第三十条第二項）は、名前を指す番号で複合語の一部ではない。例文は自作。

const RULES = loadRules("ja");
const KANJI_AT_NORMAL = { "max-kanji-continuous": RULES.find((rule) => rule.id === "max-kanji-continuous")?.levels.normal ?? 0 };

const kanjiWords = (source: string, genre = "docs/manual"): string[] =>
  runRules(buildDocument("t.md", source, ja), RULES, measuredOffOn(genre), true, genre, KANJI_AT_NORMAL)
    .findings.filter((finding) => finding.rule === "max-kanji-continuous")
    .map((finding) => String(finding.values?.["word"]));

type Kind = "noun" | "prefix" | "number" | "counter";

const FEATURES: Record<Kind, Record<string, string> | undefined> = {
  noun: undefined,
  prefix: { Bound: "Yes" },
  number: { NumType: "Card" },
  counter: { NounType: "Class", Bound: "Yes" },
};

/** 隙間なく続く語の並び。 */
const tokensOf = (words: readonly (readonly [string, Kind])[]): Token[] =>
  words.reduce<Token[]>((tokens, [surface, kind]) => {
    const start = tokens.at(-1)?.span.end ?? 0;
    const features = FEATURES[kind];
    tokens.push({
      surface,
      span: { start, end: start + surface.length },
      pos: kind === "prefix" ? "ADJ" : "NOUN",
      ...(features === undefined ? {} : { features }),
    });
    return tokens;
  }, []);

/** 語の並びまるごとを連なりとして読む。 */
const trailingOrdinalsOf = (run: readonly Token[]): ReturnType<typeof trailingOrdinals> =>
  trailingOrdinals(run, { start: 0, end: run.at(-1)?.span.end ?? 0 }, run.map((token) => token.surface).join(""));

describe("trailingOrdinals", () => {
  it("尻の、第と数と単位の項の並び", () => {
    const run = tokensOf([
      ["学校", "noun"],
      ["教育", "noun"],
      ["法", "counter"],
      ["第", "prefix"],
      ["三", "number"],
      ["十", "number"],
      ["条", "counter"],
      ["第", "prefix"],
      ["二", "number"],
      ["項", "counter"],
    ]);
    assert.deepEqual(trailingOrdinalsOf(run), { surface: "第三十条第二項", start: 5 });
  });

  it("項の前に名前が無いか、尻が項でないか、語が空なら undefined", () => {
    assert.equal(
      trailingOrdinalsOf(
        tokensOf([
          ["第", "prefix"],
          ["三", "number"],
          ["条", "counter"],
        ]),
      ),
      undefined,
    );
    assert.equal(
      trailingOrdinalsOf(
        tokensOf([
          ["教育", "noun"],
          ["法", "counter"],
          ["第", "prefix"],
          ["三", "number"],
          ["条", "counter"],
          ["違反", "noun"],
        ]),
      ),
      undefined,
    );
    assert.equal(
      trailingOrdinalsOf(
        tokensOf([
          ["教育", "noun"],
          ["三", "number"],
          ["条", "counter"],
        ]),
      ),
      undefined,
    );
    assert.equal(
      trailingOrdinalsOf(
        tokensOf([
          ["教育", "noun"],
          ["第", "prefix"],
          ["条", "counter"],
        ]),
      ),
      undefined,
    );
    assert.equal(trailingOrdinalsOf([]), undefined);
  });
});

describe("max-kanji-continuous: 法令の名前と条や項の番号", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("valid: 名前の後ろの条や項の番号は数えない", () => {
    assert.deepEqual(kanjiWords("学校教育法第三十条第二項に示された事項を重視する。"), []);
    assert.deepEqual(kanjiWords("個人情報保護法施行令第二十二条第二項第一号に定める。"), []);
  });

  it("invalid: 番号の後ろに語が続く連なりと、番号の前の長い連なりは数える", () => {
    assert.deepEqual(kanjiWords("学校教育法第三十条違反事項検討会議を開く。"), ["学校教育法第三十条違反事項検討会議"]);
    assert.deepEqual(kanjiWords("新規顧客獲得施策検討会議第三回を開く。"), ["新規顧客獲得施策検討会議"]);
  });
});
