import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { firedRules } from "./rule-run.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { contrastSentences, type ContrastWords } from "../packages/chaff/src/detectors/contrast-frame.ts";
import { placeholderSpans } from "../packages/chaff/src/detectors/placeholder-text.ts";
import { entryIn } from "../packages/chaff/src/detectors/lexicon-match.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter, Lexicon, Sentence } from "../packages/chaff/src/plugin.ts";

// The rules for the shapes of generated text: contrast framing, stock transitions, assistant residue and unfilled placeholders.
// Every example here is self-written. The AI samples under test/fixtures/ai-samples/ were written by an AI and say so.

const idsFor = (source: string, adapter: LanguageAdapter, genre = "blog/tech"): string[] => firedRules(adapter, source, genre);

/** Density rules do not measure short documents. Plain filler to pass the floor. */
const BULK_EN = "We shipped the release and reported the numbers to the team. ".repeat(40);
const BULK_JA = "本日の連絡です。今日も順調に進めます。明日も続けます。".repeat(20);

const NEW_LEXICONS = ["contrast-frame", "contrast-lead", "contrast-turn", "stock-transition", "assistant-residue", "placeholder-word"];

const entries = (...patterns: string[]): Lexicon => patterns.map((pattern) => ({ pattern }));
const plain = (text: string): Sentence => ({ span: { start: 0, end: text.length }, text });

before(async () => {
  await ja.prepare?.({ pos: true });
  await en.prepare?.({ pos: true });
});

describe("the lexicons of the AI-shape rules", () => {
  it("exist in both languages", () => {
    NEW_LEXICONS.forEach((id) => {
      assert.ok(ja.lexicons[id] !== undefined, `ja has no ${id}`);
      assert.ok(en.lexicons[id] !== undefined, `en has no ${id}`);
    });
  });
});

describe("contrastSentences", () => {
  const words: ContrastWords = { frames: entries("not only", "not just"), leads: entries("it's not"), turns: entries("it's", "but") };

  it("counts a sentence with a frame word", () => {
    assert.deepEqual(
      contrastSentences([plain("This is not just a tool."), plain("Plain words.")], words).map((sentence) => sentence.text),
      ["This is not just a tool."],
    );
  });

  it("counts a denial answered later in the same sentence", () => {
    assert.equal(contrastSentences([plain("It's not a perk, it's a necessity.")], words).length, 1);
  });

  it("counts a denial answered at the start of the next sentence, once", () => {
    const found = contrastSentences([plain("It's not a perk."), plain("It's a necessity.")], words);
    assert.deepEqual(
      found.map((sentence) => sentence.text),
      ["It's not a perk."],
    );
  });

  it("does not count a denial nobody answers", () => {
    assert.equal(contrastSentences([plain("It's not ready."), plain("We will ship next week.")], words).length, 0);
  });

  it("does not count a turn that comes before the denial", () => {
    assert.equal(contrastSentences([plain("But it's not ready.")], words).length, 0);
  });

  it("does not take the denial's own words as its answer", () => {
    assert.equal(contrastSentences([plain("It's not ready.")], words).length, 0);
  });

  it("does not take a second denial as the answer to the first", () => {
    assert.equal(contrastSentences([plain("It's not ready."), plain("It's not tested.")], words).length, 0);
    assert.equal(contrastSentences([plain("It's not ready, it's not tested.")], words).length, 0);
  });

  it("reads curly apostrophes as straight ones when there are no tags", () => {
    assert.equal(contrastSentences([plain("It’s not a perk, it’s a necessity.")], words).length, 1);
    assert.equal(entryIn(plain("I don’t have access to real-time data."), { pattern: "I don't have access to real-time" }), true);
  });

  it("returns nothing for no sentences or empty word lists", () => {
    assert.deepEqual(contrastSentences([], words), []);
    assert.deepEqual(contrastSentences([plain("It's not a perk, it's a necessity.")], { frames: [], leads: [], turns: [] }), []);
  });
});

describe("entryIn without tags", () => {
  // Generated sentences and patterns with no curly apostrophe: the match is the plain case-insensitive containment.
  const LETTERS = ["a", "B", "t", "'", " ", "\n", "s", "I", "で", "は"];
  const SAMPLES_TO_TRY = 5000;
  const generated = (seed: number, length: number): string =>
    Array.from({ length }, (_unused, index) => LETTERS[(seed * 31 + index * 17 + ((seed >> 3) ^ index)) % LETTERS.length] ?? "").join("");

  it("matches as plain containment when no apostrophe is curly", () => {
    Array.from({ length: SAMPLES_TO_TRY }, (_unused, seed) => seed).forEach((seed) => {
      const text = generated(seed, 1 + (seed % 12));
      const pattern = generated(seed * 7 + 3, 1 + (seed % 4));
      const expected = text.replace(/\s+/gu, " ").trim().toLowerCase().includes(pattern.toLowerCase());
      assert.equal(entryIn(plain(text), { pattern }), expected, JSON.stringify({ text, pattern }));
    });
  });
});

describe("placeholderSpans", () => {
  const words = entries("your", "insert", "company name", "date", "会社名", "氏名");
  const found = (text: string): string[] => placeholderSpans(text, words).map((span) => text.slice(span.start, span.end));

  it("finds a bracket that holds a placeholder word", () => {
    assert.deepEqual(found("Best regards, [Your Name]"), ["[Your Name]"]);
    assert.deepEqual(found("Call on [Insert Date] please."), ["[Insert Date]"]);
    assert.deepEqual(found("[Date]"), ["[Date]"]);
    assert.deepEqual(found("【会社名】の【氏名】です。"), ["【会社名】", "【氏名】"]);
    assert.deepEqual(found("［氏名］"), ["［氏名］"]);
  });

  it("does not take a word that only starts the same way", () => {
    assert.deepEqual(found("See [Dates of travel] and [Yourself]."), []);
  });

  it("does not take a Markdown link, a reference, a footnote or a checkbox", () => {
    assert.deepEqual(found("See [Your account](https://example.com)."), []);
    assert.deepEqual(found("See [Your account][1]."), []);
    assert.deepEqual(found("[Date]: https://example.com"), []);
    assert.deepEqual(found("As shown in [1], and [x] done, [ ] open."), []);
  });

  it("does not take a label that its value follows", () => {
    assert.deepEqual(found("【氏名】山田太郎"), []);
    assert.deepEqual(found("【日付】2024年4月1日"), []);
    assert.deepEqual(found("[Date]: 2024-04-01"), []);
  });

  it("returns nothing for empty text, an unclosed bracket or no words", () => {
    assert.deepEqual(found(""), []);
    assert.deepEqual(found("[Your Name"), []);
    assert.deepEqual(placeholderSpans("[Your Name]", []), []);
  });
});

describe("contrast-framing", () => {
  it("invalid: contrasts framed again and again", () => {
    const framed = "It's not a tool. It's a partner. This is not just software, but a culture. We want not only speed but also care. ".repeat(2);
    assert.ok(idsFor(`# Post\n\n${framed}${BULK_EN}`, en).includes("contrast-framing"));
  });

  it("valid: a denial nobody answers is not a frame, however often", () => {
    assert.ok(!idsFor(`# Post\n\n${"The build is late. It's not ready. ".repeat(6)}${BULK_EN}`, en).includes("contrast-framing"));
  });

  it("valid: denials in a row are facts, not frames", () => {
    assert.ok(!idsFor(`# Status\n\n${"It's not ready. It's not tested. ".repeat(6)}${BULK_EN}`, en).includes("contrast-framing"));
  });

  it("valid: saying what a page is not about, without saying what it is about", () => {
    const scoped = "This section is not about authentication. The team wrote it last week. ".repeat(6);
    assert.ok(!idsFor(`# Guide\n\n${scoped}${BULK_EN}`, en).includes("contrast-framing"));
  });

  it("valid: a short document is not measured", () => {
    assert.ok(!idsFor("# Post\n\nIt's not a tool. It's a partner. This is not just software. We want not only speed.", en).includes("contrast-framing"));
  });

  it("valid: one contrast in a long document", () => {
    assert.ok(!idsFor(`# Post\n\nThe fix helps not only the tests but also the build. ${BULK_EN}`, en).includes("contrast-framing"));
  });

  it("invalid: 「単なる」「だけでなく」が重なる", () => {
    const framed = "これは単なる道具ではありません。速さだけでなく安心も届けます。売上のみならず信頼も伸びます。".repeat(2);
    assert.ok(idsFor(`# 記事\n\n${framed}${BULK_JA}`, ja).includes("contrast-framing"));
  });

  it("invalid: 「ではありません。むしろ」で打ち消しを返す形が重なる", () => {
    const framed = "これは道具ではありません。むしろ仲間です。".repeat(3);
    assert.ok(idsFor(`# 記事\n\n${framed}${BULK_JA}`, ja).includes("contrast-framing"));
  });

  it("invalid: 「単なる X ではなく」が重なる", () => {
    assert.ok(idsFor(`# 記事\n\n${"これは単なる道具ではなく、仲間です。".repeat(3)}${BULK_JA}`, ja).includes("contrast-framing"));
  });

  it("valid: 「A ではなく B」だけの文は枠ではない", () => {
    assert.ok(!idsFor(`# 手順\n\n${"紙ではなく、画面で確認します。".repeat(6)}${BULK_JA}`, ja).includes("contrast-framing"));
  });

  it("valid: 打ち消していない「単なる」は枠ではない", () => {
    assert.ok(!idsFor(`# 報告\n\n${"これは単なる設定ミスです。".repeat(6)}${BULK_JA}`, ja).includes("contrast-framing"));
  });

  it("valid: 長い文書に 1 つなら言わない", () => {
    assert.ok(!idsFor(`# 記事\n\n速さだけでなく安心も届けます。${BULK_JA}`, ja).includes("contrast-framing"));
  });
});

describe("stock-transition", () => {
  it("invalid: sentences keep opening with Moreover and Furthermore", () => {
    const opened = "Moreover, it scales. Furthermore, it is cheap. Additionally, it is fast. In addition, it is safe. Notably, it is new. ".repeat(2);
    assert.ok(idsFor(`# Post\n\n${opened}${BULK_EN}`, en).includes("stock-transition"));
  });

  it("valid: However and Therefore carry the argument and are not counted", () => {
    const opened = "However, it scales. Therefore, it is cheap. However, it is fast. Therefore, it is safe. ".repeat(3);
    assert.ok(!idsFor(`# Post\n\n${opened}${BULK_EN}`, en).includes("stock-transition"));
  });

  it("valid: a transition word inside a sentence is not counted", () => {
    const inside = "We did it and, moreover, it worked. It scales and, furthermore, it is cheap. ".repeat(4);
    assert.ok(!idsFor(`# Post\n\n${inside}${BULK_EN}`, en).includes("stock-transition"));
  });

  it("valid: 'In addition to' opens a phrase, not a transition", () => {
    const opened = "In addition to the tests, we ran the build. ".repeat(8);
    assert.ok(!idsFor(`# Post\n\n${opened}${BULK_EN}`, en).includes("stock-transition"));
  });

  it("invalid: 文が「さらに」「加えて」で始まり続ける", () => {
    const opened = "さらに、速くなります。加えて、安くなります。このように、良いことばかりです。さらに、安全です。".repeat(2);
    assert.ok(idsFor(`# 記事\n\n${opened}${BULK_JA}`, ja).includes("stock-transition"));
  });

  it("valid: 「また」は数えない", () => {
    const opened = "また、速くなります。また、安くなります。また、安全です。".repeat(3);
    assert.ok(!idsFor(`# 記事\n\n${opened}${BULK_JA}`, ja).includes("stock-transition"));
  });
});

describe("assistant-residue", () => {
  it("invalid: a knowledge-cutoff disclaimer on its own", () => {
    assert.ok(idsFor("# Library\n\nAs of my last knowledge update, the wing was under discussion.", en).includes("assistant-residue"));
  });

  it("valid: one courtesy a person also writes", () => {
    assert.ok(!idsFor("# Notes\n\nThe build is green. I hope this helps.", en).includes("assistant-residue"));
  });

  it("valid: one courtesy is not reported even at strict", () => {
    const found = runRules(
      buildDocument("t.md", "# Notes\n\nThe build is green. I hope this helps.", en),
      loadRules("en"),
      { "assistant-residue": "strict" },
      true,
      "blog/tech",
    ).findings.filter((finding) => finding.rule === "assistant-residue");
    assert.deepEqual(found, []);
  });

  it("invalid: two courtesies of a chat reply together", () => {
    const source = "# Notes\n\nThe build is green. I hope this helps! Let me know if you'd like a more detailed breakdown.";
    assert.ok(idsFor(source, en).includes("assistant-residue"));
  });

  it("valid: one courtesy sentence that holds two listed phrases is still one courtesy", () => {
    assert.ok(!idsFor("# Notes\n\nThe build is green. Let me know if you'd like a more detailed breakdown.", en).includes("assistant-residue"));
  });

  it("valid: one courtesy repeated is still one courtesy", () => {
    assert.ok(!idsFor("# Notes\n\nThe build is green. I hope this helps. The docs are up. I hope this helps.", en).includes("assistant-residue"));
  });

  it("valid: an email's ordinary offer to answer questions", () => {
    assert.ok(!idsFor("# Notes\n\nPlease feel free to reach out if you have any questions.", en, "business/email").includes("assistant-residue"));
  });

  it("invalid: 知識の期限の断り書き", () => {
    assert.ok(idsFor("# 図書館\n\n私の知識は2023年時点のものです。", ja).includes("assistant-residue"));
  });

  it("valid: 「お役に立てれば幸いです」だけなら言わない", () => {
    assert.ok(!idsFor("# 連絡\n\n資料を送ります。お役に立てれば幸いです。", ja, "business/email").includes("assistant-residue"));
  });

  it("invalid: 会話の返事の決まり文句が 2 つ", () => {
    const source = "# 連絡\n\n資料を送ります。お役に立てれば幸いです。他にご質問があれば、お気軽にお尋ねください。";
    assert.ok(idsFor(source, ja, "business/email").includes("assistant-residue"));
  });

  it("reports every sentence that holds a phrase, so each can be rewritten", () => {
    const source = "# Notes\n\nThe build is green. I hope this helps! Let me know if you'd like a more detailed breakdown.";
    const found = runRules(buildDocument("t.md", source, en), loadRules("en"), {}, true, "blog/tech").findings.filter(
      (finding) => finding.rule === "assistant-residue",
    );
    assert.equal(found.length, 2);
  });
});

describe("unfilled-placeholder", () => {
  it("invalid: a template blank left in a letter", () => {
    assert.ok(idsFor("# Letter\n\nDear [Recipient's Name],\n\nThanks for the call.", en, "business/email").includes("unfilled-placeholder"));
  });

  it("reports the line the blank is on, not the line its sentence starts on", () => {
    const source = "# Letter\n\nBest regards,\n[Your Name]\n";
    const found = runRules(buildDocument("t.md", source, en), loadRules("en"), {}, true, "business/email").findings.find(
      (finding) => finding.rule === "unfilled-placeholder",
    );
    assert.equal(found?.line, 4);
  });

  it("valid: a Markdown link whose text starts with a placeholder word", () => {
    assert.ok(!idsFor("# Letter\n\nSee [your account](https://example.com) for details.", en).includes("unfilled-placeholder"));
  });

  it("invalid: 【会社名】を埋め忘れている", () => {
    assert.ok(idsFor("# 連絡\n\n【会社名】の田中です。", ja, "business/email").includes("unfilled-placeholder"));
  });

  it("valid: 例として置いた「○○」は言わない", () => {
    assert.ok(!idsFor("# 記入例\n\n○○公民館で開きます。", ja, "business/report").includes("unfilled-placeholder"));
  });
});

describe("the lexicon additions", () => {
  it("ai-tell: the words a generated encyclopedia article leans on add up", () => {
    const source = "# Library\n\nThe library stands as a vibrant focal point, nestled in the heart of the town and showcasing valuable insights.";
    assert.ok(idsFor(source, en).includes("ai-tell"));
  });

  it("ai-tell: 生成文の記事の言い回しが積み上がる", () => {
    const source = "# 記事\n\n本記事では、図書館の役割について探っていきましょう。図書館は地域の一翼を担う存在です。未来をより豊かにしていきます。";
    assert.ok(idsFor(source, ja).includes("ai-tell"));
  });

  it("ai-tell: 生成 AI 以後の記事で増えた言い回しも、活用した形で積み上がる", () => {
    const source = [
      "# 記事",
      "",
      "調査で課題が浮き彫りになりました。性能を最大限に引き出すには設定が要ります。大規模な案件で真価を発揮しました。",
      "強力な武器になります。ステップバイステップで進めます。多角的な視点と包括的な分析を行います。",
      "シームレスに連携できます。速度が大幅に向上しました。",
    ].join("\n");
    assert.ok(idsFor(source, ja).includes("ai-tell"));
  });

  it("ai-tell: 増えた言い回しは、どれも活用した形の文に当たる", () => {
    const cases: readonly (readonly [string, string])[] = [
      ["浮き彫りになる", "調査で課題が浮き彫りになりました。"],
      ["最大限に引き出す", "性能を最大限に引き出しています。"],
      ["真価を発揮する", "大規模な案件で真価を発揮しました。"],
      ["強力な武器", "型は強力な武器になります。"],
      ["ステップバイステップ", "ステップバイステップで進めます。"],
      ["多角的な", "多角的な視点で見ます。"],
      ["包括的な", "包括的な分析を行います。"],
      ["シームレスに", "シームレスに連携できます。"],
      ["大幅に向上する", "速度が大幅に向上しました。"],
    ];
    cases.forEach(([pattern, sentence]) => {
      const doc = buildDocument("t.md", `# 記事\n\n${sentence}`, ja);
      const entry = (doc.lexicons["ai-tell"] ?? []).find((candidate) => candidate.pattern === pattern);
      const first = doc.sentences.find((candidate) => candidate.text.includes(sentence.slice(0, 4)));
      assert.ok(entry !== undefined && first !== undefined && entryIn(first, entry), `${pattern} / ${sentence}`);
    });
  });

  it("ai-tell: 増えた言い回しが 1 つだけなら言わない", () => {
    assert.ok(!idsFor("# 記事\n\n調査で課題が浮き彫りになりました。来月に直します。", ja).includes("ai-tell"));
  });

  it("stock-transition: 「これにより、」は因果を言う語なので数えない", () => {
    const opened = "キャッシュを入れました。これにより、問い合わせが減りました。これにより、費用も下がりました。".repeat(3);
    assert.ok(!idsFor(`# 記事\n\n${opened}${BULK_JA}`, ja).includes("stock-transition"));
  });

  it("closing-cliche: 「いかがでしたでしょうか」で締める", () => {
    assert.ok(idsFor("# 題\n\n本文です。\n\n## まとめ\n\nいかがでしたでしょうか。", ja).includes("closing-cliche"));
  });
});

const SAMPLES = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "ai-samples");
const SAMPLE_GENRES: Readonly<Record<string, string>> = { blog: "blog/tech", article: "blog/owned-media", email: "business/email" };
const AI_RULES = ["ai-tell", "contrast-framing", "stock-transition", "assistant-residue", "unfilled-placeholder", "ai-generated-composite"];

const SAMPLE_CASES = (
  [
    ["en", en],
    ["ja", ja],
  ] as const
).flatMap(([language, adapter]) => Object.entries(SAMPLE_GENRES).map(([name, genre]) => ({ language, adapter, name, genre })));

describe("the AI-written samples", () => {
  SAMPLE_CASES.forEach(({ language, adapter, name, genre }) => {
    it(`${language}/${name}.md fires at least one of the AI-shape rules`, () => {
      const source = readFileSync(join(SAMPLES, language, `${name}.md`), "utf8");
      const fired = idsFor(source, adapter, genre).filter((id) => AI_RULES.includes(id));
      assert.ok(fired.length > 0, `${language}/${name}.md fired none of ${AI_RULES.join(", ")}`);
    });
  });
});
