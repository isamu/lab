import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { firedRules } from "./rule-run.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { coldOpenHits, coldOpen, OPENING_SENTENCES } from "../packages/chaff/src/detectors/cold-open.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// Every example here is self-written.

const RULE = "cold-open";

const fires = (adapter: LanguageAdapter, source: string, genre = "blog/tech"): boolean => firedRules(adapter, source, genre).includes(RULE);

const shapesOf = (adapter: LanguageAdapter, source: string): string[] => {
  const doc = buildDocument("t.md", source, adapter);
  return coldOpenHits(doc, doc.lexicons[RULE] ?? [])
    .map((hit) => hit.shape)
    .toSorted((a, b) => a.localeCompare(b));
};

const JA_COLD = [
  "# 問い合わせの窓口",
  "",
  "問い合わせの窓口を一本にしたい。",
  "",
  "総務と経理に、似た質問が別々に届きます。この「似た質問」が厄介です。誰がいつ答えたのか、記録が残りません。",
  "",
  "まとめれば済む話に見えて、ここが一番難しいところです。",
  "",
].join("\n");

const EN_COLD = [
  "# One inbox",
  "",
  "You want to answer each question once.",
  "",
  "Questions reach finance and the office team separately, and it almost works. That ‘almost’ is the problem. Nobody sees who answered.",
  "",
  "Sounds simple to fix. It isn't, because each team takes questions its own way.",
  "",
].join("\n");

before(async () => {
  await ja.prepare?.({ pos: true });
  await en.prepare?.({ pos: true });
});

describe("cold-open: an opening that piles the shapes", () => {
  it("reports a Japanese opening with a bare wish, an echoed word and a teaser", () => {
    assert.deepEqual(shapesOf(ja, JA_COLD), ["echo", "teaser", "wish"]);
    assert.ok(fires(ja, JA_COLD));
  });

  it("reports an English opening with a bare wish, an echoed word and a teaser", () => {
    assert.deepEqual(shapesOf(en, EN_COLD), ["echo", "teaser", "wish"]);
    assert.ok(fires(en, EN_COLD));
  });

  it("reports two shapes at normal, and needs three at relaxed", () => {
    const twoShapes =
      "# 窓口\n\n総務と経理に、似た質問が別々に届きます。この「似た質問」が厄介です。\n\nまとめれば済む話に見えて、ここが一番難しいところです。\n";
    const doc = buildDocument("t.md", twoShapes, ja);
    const lexicon = doc.lexicons[RULE];
    assert.equal(coldOpen(doc, { limit: 2, lexicon }).length, 2);
    assert.equal(coldOpen(doc, { limit: 3, lexicon }).length, 0);
  });

  it("quotes each shape's sentence once, in document order", () => {
    const doc = buildDocument("t.md", JA_COLD, ja);
    const quotes = coldOpen(doc, { limit: 2, lexicon: doc.lexicons[RULE] }).map((finding) => finding.quote);
    assert.deepEqual(quotes, ["問い合わせの窓口を一本にしたい。", "この「似た質問」が厄介です。", "まとめれば済む話に見えて、ここが一番難しいところです。"]);
  });
});

describe("cold-open: openings a human writes", () => {
  it("does not report an opening that starts from a concrete situation", () => {
    const concrete = [
      "# 問い合わせの窓口",
      "",
      "先月、経費の締め日を尋ねる質問が、総務に 12 件、経理に 9 件届きました。答えは二通りあり、片方は古い締め日でした。",
      "",
      "窓口を一本にしたいのは、こうした食い違いをなくすためです。",
      "",
    ].join("\n");
    assert.deepEqual(shapesOf(ja, concrete), []);
    assert.ok(!fires(ja, concrete));
  });

  it("does not report a proposal that opens with its one request", () => {
    const proposal =
      "# 協賛のお願い\n\n来年の市民マラソンに協賛したい。\n\n協賛金は 30 万円で、社名がゼッケンと看板に入ります。昨年は社員 8 人が自費で走りました。\n";
    assert.deepEqual(shapesOf(ja, proposal), ["wish"]);
    assert.ok(!fires(ja, proposal, "business/proposal"));
  });

  it("does not report an English opening that starts from what happened", () => {
    const concrete =
      "# One inbox\n\nLast month, 21 questions about the expense deadline reached two teams. Two of the answers gave last year's date.\n\nThat is why we want one inbox.\n";
    assert.deepEqual(shapesOf(en, concrete), []);
    assert.ok(!fires(en, concrete));
  });

  it("does not report a teaching text that opens with Imagine alone", () => {
    const handbook = "# Narrowing\n\nImagine we have a function called pad.\n\nIt takes a string or a number, and it returns the string with spaces added.\n";
    assert.deepEqual(shapesOf(en, handbook), ["wish"]);
    assert.ok(!fires(en, handbook));
  });
});

describe("cold-open: the edges of each shape", () => {
  it("does not count a wish that is long or is not the first sentence", () => {
    const long = "# 窓口\n\n総務と経理と情報システムの三つの窓口に届く似た質問を、来月からは一つの受付でまとめて扱えるようにしたい。\n";
    assert.deepEqual(shapesOf(ja, long), []);
    const second = "# 窓口\n\n総務に質問が届きます。窓口を一本にしたい。\n";
    assert.deepEqual(shapesOf(ja, second), []);
  });

  it("does not count a quote that is not pointed at, or that the previous sentence also quoted", () => {
    assert.deepEqual(shapesOf(ja, "# 窓口\n\n似た質問が届きます。「似た質問」が厄介です。\n"), []);
    assert.deepEqual(shapesOf(ja, "# 窓口\n\n「似た質問」が届きます。この「似た質問」が厄介です。\n"), []);
  });

  it("does not count a quote whose word is not in the previous sentence", () => {
    assert.deepEqual(shapesOf(ja, "# 窓口\n\n質問が届きます。この「重複」が厄介です。\n"), []);
  });

  it("does not count a defined term in parentheses", () => {
    const contract = 'This Agreement is made between the parties. This Services Agreement (this "Agreement") starts on 1 May.\n';
    assert.deepEqual(shapesOf(en, contract), []);
  });

  it("does not count a long quotation", () => {
    const quoted =
      "# Notes\n\nShe said the release almost works on every device we tried.\n\nThat “the release almost works on every device” was the summary.\n";
    assert.deepEqual(shapesOf(en, quoted), []);
  });

  it("does not match a pointer inside another word", () => {
    assert.deepEqual(shapesOf(en, "# Notes\n\nIt almost works. Whathat ‘almost’ is odd.\n"), []);
  });

  it("does not read みたい (seems like) as a wish", () => {
    assert.deepEqual(shapesOf(ja, "# 窓口\n\nこれは冗談みたい。\n"), []);
    assert.deepEqual(shapesOf(ja, "# 窓口\n\n窓口を一本にしたい。\n"), ["wish"]);
  });

  it("does not match an echoed English word inside a longer word", () => {
    assert.deepEqual(shapesOf(en, "# Notes\n\nThe database has a cache. That ‘base’ is odd.\n"), []);
  });

  it("finds the echoed word outside nested quotes in the previous sentence", () => {
    assert.deepEqual(shapesOf(en, "# Notes\n\nWe saw “foo ‘bar’” and bar. That ‘bar’ is odd.\n"), ["echo"]);
  });

  it("does not count shapes after the opening", () => {
    const filler = Array.from({ length: OPENING_SENTENCES }, (_, index) => `第 ${String(index + 1)} 週は、問い合わせが 10 件ありました。`).join("");
    const late = `# 窓口\n\n${filler}\n\n似た質問が届きます。この「似た質問」が厄介です。まとめれば済む話に見えて、ここが一番難しいところです。\n`;
    assert.deepEqual(shapesOf(ja, late), []);
  });

  it("reports nothing for an empty document or a missing word list", () => {
    assert.deepEqual(shapesOf(ja, ""), []);
    assert.deepEqual(shapesOf(en, "# Title only\n"), []);
    const doc = buildDocument("t.md", JA_COLD, ja);
    assert.deepEqual(coldOpen(doc, { limit: 2 }), []);
  });

  it("does not run in legal documents", () => assert.ok(!fires(en, EN_COLD, "legal/contract")));
});
