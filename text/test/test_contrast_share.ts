import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { firedRules } from "./rule-run.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { contrastSentences } from "../packages/chaff/src/detectors/contrast-frame.ts";
import { contrastShare } from "../packages/chaff/src/detectors/ai-phrasing.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter, Sentence } from "../packages/chaff/src/plugin.ts";

// contrast-framing's wider forms (a bare denial answered by the next sentence, "not really about", "Not because", the
// Japanese 「ではなく、〜です。」) and its share of sentences. Every sentence here is self-written.

const RULE = "contrast-framing";

const framed = (adapter: LanguageAdapter, text: string): string[] => {
  const doc = buildDocument("t.md", text, adapter);
  const words = {
    frames: doc.lexicons["contrast-frame"] ?? [],
    leads: doc.lexicons["contrast-lead"] ?? [],
    turns: doc.lexicons["contrast-turn"] ?? [],
    amounts: doc.lexicons["contrast-amount"] ?? [],
  };
  return contrastSentences(doc.sentences, words).map((sentence) => sentence.text.trim());
};

/** Plain sentences with no contrast. Eleven words each. */
const fillerEn = (sentences: number): string => "We shipped the release and reported the numbers to the team. ".repeat(sentences);
const fillerJa = (sentences: number): string => "本日の連絡事項として、来週の作業の予定と担当者の割り当てをお知らせします。".repeat(sentences);

before(async () => {
  await en.prepare?.({ pos: true });
  await ja.prepare?.({ pos: true });
});

describe("contrast frames across two sentences (en)", () => {
  it("counts a bare denial answered by the next sentence opening with it or they", () => {
    assert.deepEqual(framed(en, "What surprised me wasn't the food. It was the evenings."), ["What surprised me wasn't the food."]);
    assert.deepEqual(framed(en, "People don't come for the food. They come for the table."), ["People don't come for the food."]);
  });

  it("does not count a bare denial answered by it or they inside the same sentence", () => {
    assert.deepEqual(framed(en, "I don't think it matters."), []);
    assert.deepEqual(framed(en, "I don't think it's ready."), []);
    assert.deepEqual(framed(en, "They didn't say why they left."), []);
  });

  it("does not count a next sentence that denies again, or opens with something else", () => {
    assert.deepEqual(framed(en, "It wasn't ready. It wasn't tested either."), []);
    assert.deepEqual(framed(en, "The build didn't pass. We fixed it on Monday."), []);
  });

  it("counts not really about … it's about, and Not because … It's because", () => {
    assert.deepEqual(framed(en, "It's not really about time. It's about which minutes I keep."), ["It's not really about time."]);
    assert.deepEqual(framed(en, "The talk was not really about tools, it's about habits."), ["The talk was not really about tools, it's about habits."]);
    assert.deepEqual(framed(en, "Not because it is cheap. It's because it works."), ["Not because it is cheap."]);
  });
});

describe("what does not answer a bare denial (en)", () => {
  it("does not count a concession opened by But after the denial", () => {
    assert.deepEqual(framed(en, "Who has time for this? Fair. I don't always. But it takes ten minutes a day."), []);
    assert.deepEqual(framed(en, "We didn't finish the audit. But the team will close it next week."), []);
  });

  it("does not count a narrated negative followed by a remark on the whole sentence", () => {
    assert.deepEqual(framed(en, "When I didn't come in for a week, the owner called me. That's more than my bank does."), []);
    assert.deepEqual(framed(en, "The parcel didn't arrive on Monday. This is the third time this month."), []);
  });

  it("still counts a bare denial answered by it or they, whatever verb follows", () => {
    assert.deepEqual(framed(en, "Working from home doesn't make me faster. It makes me calmer."), ["Working from home doesn't make me faster."]);
    assert.deepEqual(framed(en, "Guests don't really come for the food. They're here for the table."), ["Guests don't really come for the food."]);
  });

  it("still counts a full denial answered by But in the next sentence", () => {
    assert.deepEqual(framed(en, "It's not a tool. But a partner for the team."), ["It's not a tool."]);
  });
});

describe("a frame that measures an amount", () => {
  it("does not count not just one, or not only twice (more than one, not a reframe)", () => {
    assert.deepEqual(framed(en, "Buy something every couple of hours. Not just one coffee for the whole day."), []);
    assert.deepEqual(framed(en, "We checked the meter not only twice but every hour."), []);
    assert.deepEqual(framed(en, "Order not just 2 rolls but a whole tray."), []);
    assert.deepEqual(framed(ja, "一杯だけでなく、二杯目も頼んでください。"), []);
    assert.deepEqual(framed(ja, "1回だけでなく、毎週確認します。"), []);
  });

  it("still counts the same frame before a thing, not an amount", () => {
    assert.deepEqual(framed(en, "Not just a coffee shop. A second office."), ["Not just a coffee shop."]);
    assert.deepEqual(framed(en, "This is not only someone's tool but a culture."), ["This is not only someone's tool but a culture."]);
    assert.deepEqual(framed(ja, "道具だけでなく、文化も届けます。"), ["道具だけでなく、文化も届けます。"]);
  });
});

describe("「ではなく、〜です。」(ja)", () => {
  it("counts a sentence that closes with です or だ after ではなく、", () => {
    assert.deepEqual(framed(ja, "問題は道具ではなく、運用です。"), ["問題は道具ではなく、運用です。"]);
    assert.deepEqual(framed(ja, "覚えているのは部屋ではなく、匂いのほうだ。"), ["覚えているのは部屋ではなく、匂いのほうだ。"]);
  });

  it("does not count one without the comma, or one closing with ます", () => {
    assert.deepEqual(framed(ja, "紙ではなく画面で確認です。"), []);
    assert.deepEqual(framed(ja, "紙ではなく、画面で確認します。"), []);
  });
});

describe("contrast-framing counts a share of sentences", () => {
  const three =
    "It's not a tool. It's a partner. People don't come for the food. They come for the table. It's not really about time. It's about the minutes. ";

  it("reports three frames in a document of about thirty sentences", () => {
    assert.ok(firedRules(en, `# Post\n\n${three}${fillerEn(24)}`, "blog/tech").includes(RULE));
  });

  it("does not report three frames spread over a long document", () => {
    assert.ok(!firedRules(en, `# Post\n\n${three}${fillerEn(80)}`, "blog/tech").includes(RULE));
  });

  it("reports two frames in a short document, and never a single frame", () => {
    const two = "It's not a tool. It's a partner. People don't come for the food. They come for the table. ";
    assert.ok(firedRules(en, `# Post\n\n${two}${fillerEn(20)}`, "blog/tech").includes(RULE));
    const one = "It's not a tool. It's a partner. ";
    assert.ok(!firedRules(en, `# Post\n\n${one}${fillerEn(16)}`, "blog/tech").includes(RULE));
  });

  it("holds an essay to a lower share than a tech post", () => {
    // Four sentences hold the two frames; with 36 more the share is 5.0%: past the essay limit, under the default.
    const two = "It's not a tool. It's a partner. People don't come for the food. They come for the table. ";
    assert.ok(firedRules(en, `# Post\n\n${two}${fillerEn(36)}`, "blog/essay").includes(RULE));
    assert.ok(!firedRules(en, `# Post\n\n${two}${fillerEn(36)}`, "blog/tech").includes(RULE));
  });

  it("reports 「ではなく、〜です。」 three times in a short Japanese document", () => {
    const frames = "問題は道具ではなく、運用です。大事なのは速さではなく、確かさです。残るのは数字ではなく、信頼です。";
    assert.ok(firedRules(ja, `# 記事\n\n${frames}${fillerJa(14)}`, "blog/tech").includes(RULE));
  });

  it("reports a share just past the limit, and not one at the limit", () => {
    // Six sentences hold the three frames; with 44 more the share is 6.0% (the normal limit), with 43 it is 6.1%.
    assert.ok(!firedRules(en, `# Post\n\n${three}${fillerEn(44)}`, "blog/tech").includes(RULE));
    assert.ok(firedRules(en, `# Post\n\n${three}${fillerEn(43)}`, "blog/tech").includes(RULE));
  });

  it("measures the share over the sentences in the document's language", () => {
    const doc = buildDocument("t.md", "One. Two. Three. Four.", en);
    assert.equal(contrastShare(doc, 1), 25);
    assert.equal(contrastShare(buildDocument("t.md", "", en), 3), 0);
    const embedded = buildDocument("t.md", "One more time. Two more times. Three more times. 次の会議は来週の月曜日に開きます。", en);
    assert.equal(contrastShare(embedded, 1), 33.3);
  });
});

describe("contrast frames without parts of speech", () => {
  const plain = (text: string): Sentence => ({ span: { start: 0, end: text.length }, text });
  const words = {
    frames: [],
    leads: [
      { pattern: "wasn't", group: "across" },
      { pattern: "はなく、", group: "closing" },
    ],
    turns: [
      { pattern: "it", group: "across" },
      { pattern: "です", group: "closing" },
    ],
  };
  const found = (...texts: string[]): string[] => contrastSentences(texts.map(plain), words).map((sentence) => sentence.text);

  it("takes it as the next sentence's first word, not the start of Items", () => {
    assert.deepEqual(found("It wasn't the plan.", "It was luck."), ["It wasn't the plan."]);
    assert.deepEqual(found("It wasn't the plan.", "Items arrived late."), []);
  });

  it("closes 「はなく、」 only with です at the end of the same sentence", () => {
    assert.deepEqual(found("問題は道具ではなく、運用です。"), ["問題は道具ではなく、運用です。"]);
    assert.deepEqual(found("紙ではなく、画面で確認します。"), []);
  });
});
