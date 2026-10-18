import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isDocumentNumber, isNoticeAddressee, isNoticeHead, noticeWordsOf, type NoticeWords } from "../packages/chaff/src/notice-header.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";

// email-greeting-closing and an official notice's head (通達: a document number and an addressee with 殿). Self-written
// examples, shaped like the covering letter of a 法令解釈通達.

const WORDS: NoticeWords = { numberPrefixes: ["課", "直"], numberHeads: ["第"], numberTails: ["号"], addressees: ["殿"] };

const variantsOf = (source: string): string[] =>
  runRules(buildDocument("t.md", source, ja), loadRules(ja.id), {}, true, "business/email")
    .findings.filter((finding) => finding.rule === "email-greeting-closing")
    .map((finding) => finding.variant ?? "");

const NOTICE = [
  "課資3-7",
  "課個2-18",
  "令和2年7月1日",
  "",
  "各国税局長　殿",
  "沖縄国税事務所長　殿",
  "",
  "国税庁長官",
  "",
  "# 所得税基本通達の一部改正について（法令解釈通達）",
  "",
  "標記のことについては、下記のとおり定めたから、これにより取り扱われたい。",
  "",
  "（理由）",
  "",
  "法令の改正に伴い、所要の整備を図るものである。",
  "",
].join("\n");

describe("notice-header: a notice's document number and addressee", () => {
  it("reads the document number forms and an addressee with 殿", () => {
    assert.equal(isDocumentNumber("課資3-7", WORDS), true);
    assert.equal(isDocumentNumber("課個2-18", WORDS), true);
    assert.equal(isDocumentNumber("直資4－5", WORDS), true);
    assert.equal(isDocumentNumber("総務省発第123号", WORDS), true);
    assert.equal(isNoticeAddressee("各国税局長　殿", WORDS), true);
    assert.equal(isNoticeAddressee("沖縄国税事務所長殿", WORDS), true);
  });

  it("does not take a line with no digit, a sentence, a long line, a bare honorific or another form", () => {
    assert.equal(isDocumentNumber("課長", WORDS), false);
    assert.equal(isDocumentNumber("課題は3つ", WORDS), false);
    assert.equal(isDocumentNumber("課題3", WORDS), false);
    assert.equal(isDocumentNumber("課長2名", WORDS), false);
    assert.equal(isDocumentNumber("課資3-7", { ...WORDS, numberPrefixes: [""] }), false);
    assert.equal(isDocumentNumber("ABC123", { ...WORDS, numberHeads: [""], numberTails: [""] }), false);
    assert.equal(isDocumentNumber("第3回の号", WORDS), false);
    assert.equal(isDocumentNumber("課題 3 について", WORDS), false);
    assert.equal(isDocumentNumber("第3回の会議で決めた内容を号外として配る第12号", WORDS), false);
    assert.equal(isDocumentNumber("2024年10月1日", WORDS), false);
    assert.equal(isDocumentNumber("", WORDS), false);
    assert.equal(isNoticeAddressee("殿", WORDS), false);
    assert.equal(isNoticeAddressee("山田様", WORDS), false);
    assert.equal(isNoticeAddressee("殿様のお話です。", WORDS), false);
  });

  it("needs both a document number and an addressee", () => {
    assert.equal(isNoticeHead(["課資3-7", "各国税局長　殿"], WORDS), true);
    assert.equal(isNoticeHead(["課資3-7", "国税庁長官"], WORDS), false);
    assert.equal(isNoticeHead(["株式会社サンプル", "総務部　山田　殿"], WORDS), false);
    assert.equal(isNoticeHead([], WORDS), false);
    assert.equal(isNoticeHead(["課資3-7", "各国税局長　殿"], noticeWordsOf([])), false);
  });

  it("groups the lexicon's entries", () => {
    const words = noticeWordsOf([
      { pattern: "課", group: "number-prefix" },
      { pattern: "第", group: "number-head" },
      { pattern: "号", group: "number-tail" },
      { pattern: "殿", group: "addressee" },
      { pattern: "様" },
    ]);
    assert.deepEqual(words, { numberPrefixes: ["課"], numberHeads: ["第"], numberTails: ["号"], addressees: ["殿"] });
  });
});

describe("email-greeting-closing on an official notice", () => {
  it("asks no greeting and no closing of a notice", () => {
    assert.deepEqual(variantsOf(NOTICE), []);
  });

  it("still reports an email without a greeting or a closing", () => {
    const email = ["株式会社サンプル", "総務部　山田様", "", "打ち合わせの日程をお知らせします。", "", "10月13日の14時からです。", ""].join("\n");
    assert.deepEqual(
      variantsOf(email).sort((a, b) => a.localeCompare(b)),
      ["closing", "greeting"],
    );
  });

  it("still reports an email addressed with 殿 that has no document number", () => {
    const email = ["株式会社サンプル", "総務部　山田　殿", "", "打ち合わせの日程をお知らせします。", "", "10月13日の14時からです。", ""].join("\n");
    assert.deepEqual(
      variantsOf(email).sort((a, b) => a.localeCompare(b)),
      ["closing", "greeting"],
    );
  });

  it("still reports an email whose head holds a numbered topic and an addressee with 殿", () => {
    const email = ["課題3", "総務部　山田　殿", "", "打ち合わせの日程をお知らせします。", "", "10月13日の14時からです。", ""].join("\n");
    assert.deepEqual(
      variantsOf(email).sort((a, b) => a.localeCompare(b)),
      ["closing", "greeting"],
    );
  });

  it("still reports an email whose document number and 殿 come after the first sentence", () => {
    const email = ["打ち合わせの日程をお知らせします。", "", "課資3-7", "", "各国税局長　殿", "", "10月13日の14時からです。", ""].join("\n");
    assert.deepEqual(
      variantsOf(email).sort((a, b) => a.localeCompare(b)),
      ["closing", "greeting"],
    );
  });
});
