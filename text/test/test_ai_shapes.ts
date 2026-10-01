import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { firedRules } from "./rule-run.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { colonLeadIns } from "../packages/chaff/src/detectors/list-lead-in.ts";
import { endsWithColon } from "../packages/chaff/src/detectors/lead-in.ts";
import { entryIn } from "../packages/chaff/src/detectors/lexicon-match.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter, LexiconEntry } from "../packages/chaff/src/plugin.ts";

// The Japanese ai-tell entries for technical prose, announcing openers (重要なのは、, Here's the thing) and colon lead-ins
// to lists. Every example here is self-written. The paired samples under test/fixtures/ai-samples/paired/ were written by an AI.

const idsFor = (source: string, adapter: LanguageAdapter, genre = "blog/tech"): string[] => firedRules(adapter, source, genre);

/** Density rules do not measure short documents. Plain filler to pass the floor. */
const BULK_JA = "本日の連絡です。今日も順調に進めます。明日も続けます。".repeat(20);
const BULK_EN = "We shipped the release and reported the numbers to the team. ".repeat(40);

before(async () => {
  await ja.prepare?.({ pos: true });
  await en.prepare?.({ pos: true });
});

const tokenized = (adapter: LanguageAdapter, pattern: string): LexiconEntry => {
  const sentence = buildDocument("t.md", pattern, adapter).sentences[0];
  return { pattern, tokens: sentence?.tokens };
};

const sentenceOf = (adapter: LanguageAdapter, text: string) => {
  const sentence = buildDocument("t.md", text, adapter).sentences[0];
  if (sentence === undefined) throw new Error(`no sentence in ${text}`);
  return sentence;
};

/** The rules that fire with the two new rules at strict. */
const strictRules = (source: string, adapter: LanguageAdapter): string[] =>
  runRules(
    buildDocument("t.md", source, adapter),
    loadRules(adapter.id),
    { "announcing-opener": "strict", "colon-lead-in": "strict" },
    true,
    "blog/tech",
  ).findings.map((finding) => finding.rule);

const lexiconPatterns = (adapter: LanguageAdapter, id: string): string[] => (adapter.lexicons[id] ?? []).map((entry) => entry.pattern);

describe("ai-tell (ja): metaphors and calques of technical prose", () => {
  const INFLECTED: ReadonlyArray<readonly [string, string]> = [
    ["静かに壊れる", "テストは静かに壊れていました。"],
    ["静かに失敗する", "設定が無いと静かに失敗します。"],
    ["黙って無視される", "その引数は黙って無視されます。"],
    ["黙って捨てられる", "古いログは黙って捨てられました。"],
    ["黙って失敗する", "書き込みが黙って失敗していた。"],
    ["時間を溶かす", "調査で時間を溶かしてしまった。"],
    ["一つずつ潰す", "警告を一つずつ潰していきます。"],
    ["ひとつずつ潰す", "原因をひとつずつ潰した。"],
    ["効いてくる", "この差が後から効いてきます。"],
    ["地味に効く", "この設定は地味に効きます。"],
    ["温度感", "チームの温度感をそろえます。"],
    ["血の通った", "血の通ったドキュメントにしたい。"],
  ];

  it("every entry is in the lexicon", () => {
    const patterns = lexiconPatterns(ja, "ai-tell");
    INFLECTED.forEach(([pattern]) => assert.ok(patterns.includes(pattern), pattern));
  });

  INFLECTED.forEach(([pattern, sentence]) => {
    it(`「${pattern}」 matches its inflected form 「${sentence}」`, () => {
      assert.ok(entryIn(sentenceOf(ja, sentence), tokenized(ja, pattern)));
    });

    it(`「${pattern}」 alone, even repeated, stays under the limit`, () => {
      assert.ok(!idsFor(`# 記事\n\n${sentence.repeat(3)}${BULK_JA}`, ja).includes("ai-tell"));
    });
  });

  it("does not match the literal sense or a split phrase", () => {
    assert.ok(!entryIn(sentenceOf(ja, "静かな部屋で壊れた椅子を直した。"), tokenized(ja, "静かに壊れる")));
    assert.ok(!entryIn(sentenceOf(ja, "彼は黙って席を立ち、無視されたと感じた。"), tokenized(ja, "黙って無視される")));
  });

  it("a single metaphor does not fire ai-tell; several together do", () => {
    assert.ok(!idsFor(`# 記事\n\nこの設定は地味に効きます。${BULK_JA}`, ja).includes("ai-tell"));
    const four = "テストは静かに壊れていました。引数は黙って無視されます。調査で時間を溶かしました。警告を一つずつ潰していきます。";
    assert.ok(!idsFor(`# 記事\n\n${four}${BULK_JA}`, ja).includes("ai-tell"));
    assert.ok(idsFor(`# 記事\n\n${four}この差が後から効いてきます。${BULK_JA}`, ja).includes("ai-tell"));
  });

  it("keeps out what people wrote as much before generated text (解像度, 腹落ち, 肌感, 側に倒す, 真理)", () => {
    const patterns = lexiconPatterns(ja, "ai-tell");
    ["解像度", "解像度を上げる", "腹落ち", "肌感", "安全側に倒す", "側に倒す", "真理", "境地", "深淵", "宿命"].forEach((word) =>
      assert.ok(!patterns.includes(word), word),
    );
  });
});

describe("announcing-opener", () => {
  const JA_THREE = "重要なのは、設定です。ポイントは、ログです。正直に言うと、手順書は古い。";
  const EN_THREE = "The key point is the settings. Here's the thing: logs matter. Honestly, the manual is old.";

  const OPENERS: ReadonlyArray<readonly [LanguageAdapter, readonly string[]]> = [
    [ja, ["重要なのは", "ポイントは", "正直に言うと", "注目すべきは", "注目すべき点は", "ここで注目すべきは"]],
    [
      en,
      [
        "The key point is",
        "The key takeaway is",
        "Here's the thing",
        "Here's why",
        "Honestly,",
        "To be honest,",
        "What matters is",
        "What matters most is",
        "What's important is",
        "The important thing is",
        "The bottom line is",
        "The short answer is",
        "The real question is",
        "It's worth noting",
      ],
    ],
  ];

  OPENERS.forEach(([adapter, openers]) => {
    it(`${adapter.id}: the lexicon holds exactly the measured openers`, () => {
      assert.deepEqual(lexiconPatterns(adapter, "announcing-opener"), openers);
    });

    openers.forEach((opener) => {
      it(`${adapter.id}: three sentences opening with 「${opener}」 fire`, () => {
        const sentence = adapter.id === "ja" ? `${opener}、設定です。` : `${opener} the settings. `;
        assert.ok(idsFor(`# T\n\n${sentence.repeat(3)}`, adapter).includes("announcing-opener"));
      });
    });
  });

  it("fires on three announcing openers in either language", () => {
    assert.ok(idsFor(`# 記事\n\n${JA_THREE}`, ja).includes("announcing-opener"));
    assert.ok(idsFor(`# Post\n\n${EN_THREE}`, en).includes("announcing-opener"));
  });

  it("two are not enough at normal, and are at strict", () => {
    const two = "重要なのは、設定です。ポイントは、ログです。";
    assert.ok(!idsFor(`# 記事\n\n${two}`, ja).includes("announcing-opener"));
    assert.ok(strictRules(`# 記事\n\n${two}`, ja).includes("announcing-opener"));
  });

  it("counts only the start of a sentence, not 「このポイントは」 inside one", () => {
    const inside = "このポイントは、設定です。その重要なのは、ログです。率直に正直に言うと、古い。";
    assert.ok(!idsFor(`# 記事\n\n${inside}`, ja).includes("announcing-opener"));
  });

  it("counts an opener inside a list item", () => {
    const listed = "# 記事\n\n- 重要なのは、設定です。\n- ポイントは、ログです。\n- 正直に言うと、古い。\n";
    assert.ok(idsFor(listed, ja).includes("announcing-opener"));
  });

  it("does not run where announcements are the form (docs, legal, speech, literature)", () => {
    ["docs/manual", "legal/contract", "speech/address", "literature/essay"].forEach((genre) =>
      assert.ok(!idsFor(`# 記事\n\n${JA_THREE}`, ja, genre).includes("announcing-opener"), genre),
    );
  });

  it("leaves out what people opened with as much before generated text (大事なのは, 結論から言うと)", () => {
    const patterns = lexiconPatterns(ja, "announcing-opener");
    ["大事なのは", "結論から言うと", "要するに"].forEach((word) => assert.ok(!patterns.includes(word), word));
  });
});

describe("endsWithColon", () => {
  it("reads a colon at the end, past bold marks and spaces", () => {
    ["次の通りです：", "Here's what you need:", "**手順**:", "ポイント  :  "].forEach((text) => assert.ok(endsWithColon(text), text));
  });

  it("does not read a colon inside the sentence", () => {
    ["時刻: 10 時に集合します。", "Note: this is fine.", ""].forEach((text) => assert.ok(!endsWithColon(text), text));
  });
});

describe("colonLeadIns", () => {
  const leadInsOf = (source: string, adapter: LanguageAdapter = ja): string[] => {
    const doc = buildDocument("t.md", source, adapter);
    return colonLeadIns(doc.sentences, doc.lists, doc.listSpans, doc.source).map((sentence) => sentence.text.trim());
  };

  it("finds the prose sentence ending in a colon right before a list", () => {
    assert.deepEqual(leadInsOf("# 題\n\n準備は次の通りです：\n\n- 鍵\n- 地図\n"), ["準備は次の通りです："]);
    assert.deepEqual(leadInsOf("# Title\n\nHere's what you need:\n\n- A key\n", en), ["Here's what you need:"]);
  });

  it("finds a bold label ending in a colon", () => {
    assert.equal(leadInsOf("# 題\n\n**準備**:\n\n- 鍵\n").length, 1);
  });

  it("does not count a lead-in that does not end in a colon", () => {
    assert.deepEqual(leadInsOf("# 題\n\n準備は次のとおりとする。\n\n- 鍵\n"), []);
  });

  it("does not count a colon sentence with a paragraph between it and the list", () => {
    assert.deepEqual(leadInsOf("# 題\n\n準備は次の通りです：\n\n鍵は受付で受け取ってください。\n\n- 鍵\n"), []);
  });

  it("does not count a colon sentence with a code block or a table between it and the list", () => {
    assert.deepEqual(leadInsOf("# 題\n\n設定は次の通りです：\n\n```\nkey: value\n```\n\n- 鍵\n"), []);
    assert.deepEqual(leadInsOf("# 題\n\n設定は次の通りです：\n\n| 名前 | 値 |\n| --- | --- |\n| a | 1 |\n\n- 鍵\n"), []);
  });

  it("finds a lead-in with no blank line before its list", () => {
    assert.deepEqual(leadInsOf("# 題\n\n準備は次の通りです：\n- 鍵\n- 地図\n"), ["準備は次の通りです："]);
  });

  it("does not count a list item that ends in a colon once its code is masked", () => {
    assert.deepEqual(leadInsOf("# 題\n\n本文です。\n\n- 例: `after_update :name`\n  - 名前が変わったときに動く\n"), []);
  });

  it("returns nothing for a document without lists", () => {
    assert.deepEqual(leadInsOf("# 題\n\n次の通りです：\n"), []);
  });
});

describe("colon-lead-in", () => {
  const twoLeadIns = (bulk: string, first: string, second: string): string => `# 記事\n\n${bulk}\n\n${first}\n\n- 一\n- 二\n\n${second}\n\n- 三\n- 四\n`;

  it("fires on colon lead-ins piling up in a long document", () => {
    const dense = `# 記事\n\n${BULK_JA.slice(0, 520)}\n\n準備：\n\n- 鍵\n- 地図\n\n流れ：\n\n- 集合\n- 出発\n\n片付け：\n\n- 掃除\n`;
    assert.ok(idsFor(dense, ja).includes("colon-lead-in"));
  });

  it("does not fire on one lead-in, nor on a short document", () => {
    assert.ok(!idsFor(`# 記事\n\n${BULK_JA}\n\n準備：\n\n- 鍵\n`, ja).includes("colon-lead-in"));
    assert.ok(!idsFor("# 記事\n\n準備：\n\n- 鍵\n\n流れ：\n\n- 集合\n", ja).includes("colon-lead-in"));
  });

  it("does not fire when the lead-ins are spread over a long document", () => {
    assert.ok(!idsFor(twoLeadIns(`${BULK_JA}${BULK_JA}`, "準備は次の通りです：", "流れは次の通りです："), ja).includes("colon-lead-in"));
  });

  it("does not run in manuals, legal text or literature, where lists after a colon are the form", () => {
    const dense = `# 記事\n\n${BULK_JA.slice(0, 520)}\n\n準備：\n\n- 鍵\n\n流れ：\n\n- 集合\n\n片付け：\n\n- 掃除\n`;
    ["docs/manual", "legal/contract", "literature/essay"].forEach((genre) => assert.ok(!idsFor(dense, ja, genre).includes("colon-lead-in"), genre));
  });

  it("measures English per 1000 words with its own limit", () => {
    const dense = `# Post\n\n${BULK_EN.slice(0, 1300)}\n\nBring:\n\n- A key\n\nPlan:\n\n- Meet\n\nAfter:\n\n- Clean\n`;
    assert.ok(idsFor(dense, en).includes("colon-lead-in"));
  });

  it("lets English human prose keep more colon lead-ins than Japanese (a few per 1000 words pass)", () => {
    const spread = `# Post\n\n${BULK_EN}\n\nBring:\n\n- A key\n\nPlan:\n\n- Meet\n`;
    assert.ok(!idsFor(spread, en).includes("colon-lead-in"));
  });
});

describe("ai-generated-composite reads the new rules", () => {
  it("names announcing-opener and colon-lead-in among the signals it found", () => {
    const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "fixtures", "ai-samples", "paired", "ja", "tech", "ai.md"), "utf8");
    const composite = runRules(buildDocument("ai.md", source, ja), loadRules("ja"), {}, true, "blog/tech").findings.find(
      (finding) => finding.rule === "ai-generated-composite",
    );
    const signals = String(composite?.values["word"] ?? "");
    assert.ok(signals.includes("announcing-opener") && signals.includes("colon-lead-in"), signals);
  });
});

const PAIRED = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "ai-samples", "paired");
const KINDS: Readonly<Record<string, string>> = { tech: "blog/tech", business: "business/report", essay: "blog/essay" };
const NEW_RULES = ["ai-tell", "announcing-opener", "colon-lead-in"];
const AI_SHAPES = [...NEW_RULES, "contrast-framing", "stock-transition", "assistant-residue", "closing-cliche", "ai-generated-composite"];
const ADAPTERS: ReadonlyArray<readonly [string, LanguageAdapter]> = [
  ["ja", ja],
  ["en", en],
];

type PairedCase = { readonly language: string; readonly adapter: LanguageAdapter; readonly kind: string; readonly genre: string };

const PAIRED_CASES: readonly PairedCase[] = ADAPTERS.flatMap(([language, adapter]) =>
  Object.entries(KINDS).map(([kind, genre]) => ({ language, adapter, kind, genre })),
);

const firedOnVariant = (paired: PairedCase, variant: string): string[] =>
  idsFor(readFileSync(join(PAIRED, paired.language, paired.kind, `${variant}.md`), "utf8"), paired.adapter, paired.genre);

describe("the paired samples (same content, three ways)", () => {
  PAIRED_CASES.forEach((paired) => {
    const name = `${paired.language}/${paired.kind}`;
    it(`${name}: the generated-style version fires an AI-shape rule`, () => {
      assert.ok(firedOnVariant(paired, "ai").some((id) => AI_SHAPES.includes(id)));
    });
    it(`${name}: the human-style version fires none of the new rules`, () => {
      assert.deepEqual(
        firedOnVariant(paired, "human").filter((id) => NEW_RULES.includes(id)),
        [],
      );
    });
    it(`${name}: the rewritten version fires none of the new rules`, () => {
      assert.deepEqual(
        firedOnVariant(paired, "rewritten").filter((id) => NEW_RULES.includes(id)),
        [],
      );
    });
  });
});
