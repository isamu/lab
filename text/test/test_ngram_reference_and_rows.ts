import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { partReferenceSpans, quotedClosingSpans } from "../packages/chaff/src/detectors/gram-furniture.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// ngram-repetition: a manual's cross-reference line (詳しくは「…」を確認してください。), the last cell of a table run into
// lines (〜が完了した旨を通知する。), a reference to a numbered part (set out in Section 3), and a paper's term phrased as a
// gerund (what occupying the anticipatory mode requires) or as a subject (the anticipatory mode is). Each is checked both
// ways: the same words written as the writer's own phrasing are still counted. Self-written text.

const worst = (adapter: LanguageAdapter, source: string, genre = "business/report"): string | undefined => {
  const finding = runRules(buildDocument("t.md", source, adapter), loadRules(adapter.id), {}, true, genre).findings.find(
    (each) => each.rule === "ngram-repetition",
  );
  return finding === undefined ? undefined : String(finding.values["word"]);
};

const JA_FILLER = Array.from({ length: 70 }, (_, index) => `項目${String(index)}の値${String(index)}。`).join("");
const EN_FILLER = Array.from({ length: 40 }, (_, index) => `Item ${String(index)} holds value ${String(index * 3)} today.`).join(" ");

const PAGES = [
  "申請書の書き方",
  "添付書類の入れ方",
  "入力できる文字",
  "一時保存のしかた",
  "提出先の選び方",
  "処理状況の見方",
  "手数料の納め方",
  "取下げのしかた",
];
const STEPS = [
  "申請書を開きます。",
  "書類を添えます。",
  "文字を入力します。",
  "途中で保存します。",
  "提出先を選びます。",
  "状況を見ます。",
  "手数料を納めます。",
  "申請を取り下げます。",
];
const DOCS = ["約款", "申込書", "見積書", "契約書", "請求書", "領収書", "明細書", "通知書"];
const SUBJECTS = ["登録", "変更", "削除", "解除", "仮申請", "本申請", "再設定", "認証"];
const OPENERS = [
  "Section one asks",
  "The survey shows",
  "Our model predicts",
  "A critic doubts",
  "The law fixes",
  "Practice decides",
  "Nobody knows",
  "Theory explains",
];
const DEMANDS = ["requires", "demands", "costs", "means", "involves", "changes", "needs", "asks"];
const TOPICS = ["safety", "cost", "privacy", "speed", "access", "quality", "scope", "timing"];

before(async () => {
  await ja.prepare?.({ pos: true });
  await en.prepare?.({ pos: true });
});

describe("ngram-repetition: a cross-reference line in a manual", () => {
  const manual = (line: (index: number) => string): string =>
    [`# 電子申請の手引き\n\n${JA_FILLER}`, ...STEPS.map((step, index) => `## 手順${String(index + 1)}\n\n${step}${line(index)}`)].join("\n\n");

  it("does not count the closing that points to a quoted page", () => {
    assert.equal(
      worst(
        ja,
        manual((index) => `詳しくは「${PAGES[index] ?? ""}」を確認してください。`),
        "docs/manual",
      ),
      undefined,
    );
  });

  it("still counts the same closing after the writer's own words", () => {
    assert.notEqual(
      worst(
        ja,
        manual((index) => `届いた${DOCS[index] ?? ""}の中身を確認してください。`),
        "docs/manual",
      ),
      undefined,
    );
  });

  it("reads a short closing after a quote, and nothing longer", () => {
    assert.deepEqual(quotedClosingSpans("詳しくは「入力できる文字」を確認してください。"), [{ start: 13, end: 23 }]);
    assert.deepEqual(quotedClosingSpans("「保存」をクリックして、次の画面に進んでください。"), []);
    assert.deepEqual(quotedClosingSpans("「保存」をクリックして申請書の入力画面に進んでください。"), []);
    assert.deepEqual(quotedClosingSpans("責任を持って「実行」してまいります。"), []);
    assert.deepEqual(quotedClosingSpans("「生活の支援」に力を尽くしてまいります。"), []);
    assert.deepEqual(quotedClosingSpans("確認してください。"), []);
    assert.deepEqual(quotedClosingSpans(""), []);
  });
});

describe("ngram-repetition: the last cell of a table run into lines", () => {
  const rows = (purpose: (subject: string) => string): string =>
    [
      `# 発信メール一覧\n\n${JA_FILLER}`,
      "メール件名\n\n送信先\n\n目的",
      ...SUBJECTS.map((subject) => `[通知]${subject}完了のお知らせ\n\n登録されたメールアドレス\n\n${purpose(subject)}`),
    ].join("\n\n");

  it("does not count the formula each row's purpose cell repeats", () => {
    assert.equal(
      worst(
        ja,
        rows((subject) => `利用者情報の${subject}が完了した旨を通知する。`),
        "docs/manual",
      ),
      undefined,
    );
  });

  it("still counts the formula in prose paragraphs", () => {
    const prose = [
      `# 発信メール一覧\n\n${JA_FILLER}`,
      ...SUBJECTS.map((subject) => `手続を進めると、利用者情報の${subject}が完了した旨を通知する。届いたメールは保存しておく。`),
    ].join("\n\n");
    assert.notEqual(worst(ja, prose, "docs/manual"), undefined);
  });
});

describe("ngram-repetition: a reference to a numbered part", () => {
  it("does not count the words around Section 3 and Table 2", () => {
    const paper = [
      `# A study\n\n${EN_FILLER}`,
      ...TOPICS.map((topic, index) => `The case for ${topic} set out in Section ${String(index + 1)} bears on this.`),
    ].join("\n\n");
    assert.equal(worst(en, paper, "academic/paper"), undefined);
  });

  it("still counts the same words around an ordinary noun", () => {
    const paper = [`# A study\n\n${EN_FILLER}`, ...TOPICS.map((topic) => `The case for ${topic} set out in the report bears on this.`)].join("\n\n");
    assert.notEqual(worst(en, paper, "academic/paper"), undefined);
  });

  it("reads numbered parts in both languages", () => {
    assert.deepEqual(
      partReferenceSpans("as Section 3.1 and Table 2 show, see Appendix B", "word").map((span) => span.end - span.start),
      ["Section 3.1".length, "Table 2".length, "Appendix B".length],
    );
    assert.deepEqual(partReferenceSpans("the second section shows", "word"), []);
    assert.deepEqual(
      partReferenceSpans("表2と第3章を見る", "char").map((span) => span.end - span.start),
      [2, 3],
    );
  });
});

describe("ngram-repetition: a paper's term phrased as a gerund", () => {
  const paper = (sentence: (topic: string, opener: string, demand: string) => string): string =>
    [`# A study\n\n${EN_FILLER}`, ...TOPICS.map((topic, index) => sentence(topic, OPENERS[index] ?? "", DEMANDS[index] ?? ""))].join("\n\n");

  it("does not count a gerund phrase in a noun's place", () => {
    assert.equal(
      worst(
        en,
        paper((topic, opener, demand) => `${opener} what occupying the anticipatory mode ${demand} for ${topic}.`),
        "academic/paper",
      ),
      undefined,
    );
  });

  it("does not count the term as the subject of be", () => {
    assert.equal(
      worst(
        en,
        paper((topic) => `For ${topic}, the anticipatory mode is a duty of its own.`.replace("a duty", `a ${topic} duty`)),
        "academic/paper",
      ),
      undefined,
    );
  });

  it("still counts the same words used as a predicate", () => {
    assert.notEqual(
      worst(
        en,
        paper((topic) => `For ${topic}, the agents are occupying the anticipatory mode again.`),
        "academic/paper",
      ),
      undefined,
    );
  });

  it("still counts a participle clause after a comma", () => {
    assert.notEqual(
      worst(
        en,
        paper((topic) => `We checked ${topic}, occupying the anticipatory mode again.`),
        "academic/paper",
      ),
      undefined,
    );
  });
});
