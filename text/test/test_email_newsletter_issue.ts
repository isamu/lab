import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isIssueHead, issueWordsOf, type IssueWords } from "../packages/chaff/src/newsletter-issue.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// email-greeting-closing and a newsletter's issue (メールマガジン第90号, Vol. 12). Self-written examples, shaped like an
// office's mail magazine: the issue number, items marked by 【】 and ■, and the office's contact block at the end.

const WORDS: IssueWords = [
  { head: "第", tail: "号" },
  { head: "Vol. ", tail: "" },
];

const variantsOf = (source: string, adapter: LanguageAdapter = ja): string[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(adapter.id), {}, true, "business/email")
    .findings.filter((finding) => finding.rule === "email-greeting-closing")
    .map((finding) => finding.variant ?? "");

const ISSUE = [
  "# 試験課メールマガジン第12号（令和8年4月1日）",
  "",
  "第12号 2026/4/1",
  "【新着】（試験課）",
  "春の研修の資料を掲載しました。各校で御活用ください。",
  "",
  "■研修の申込みを受け付けています",
  "申込みは4月20日までにお願いします。",
  "",
  "## お問合せ先",
  "",
  "試験課 研修係",
  "",
  "03-0000-0000",
  "",
].join("\n");

const LETTER = ["# 研修のご案内", "", "各位", "", "春の研修の資料を掲載しました。各校で御活用ください。", "", "申込みは4月20日までにお願いします。", ""].join(
  "\n",
);

describe("newsletter-issue: an issue number in the title", () => {
  it("reads 第…号 with a space, a bracket or the line's end after it, and Vol. with a number, in a heading", () => {
    assert.equal(isIssueHead(["# 試験課メールマガジン第12号（令和8年4月1日）"], WORDS), true);
    assert.equal(isIssueHead(["## 試験課ニュース 第12号"], WORDS), true);
    assert.equal(isIssueHead(["# 試験課メールマガジン第１２号【特集】"], WORDS), true);
    assert.equal(isIssueHead(["# Staff Newsletter, Vol. 12, April"], WORDS), true);
    assert.equal(isIssueHead(["# Staff Newsletter Vol. 12[April 2026]"], WORDS), true);
  });

  it("does not read a line that is no heading, a number followed by a word, a number without its tail, or a Latin head inside a word", () => {
    assert.equal(isIssueHead(["第12号 2026/4/1"], WORDS), false);
    assert.equal(isIssueHead(["件名：議案 第3号"], WORDS), false);
    assert.equal(isIssueHead(["Subject: Citation to Vol. 12"], WORDS), false);
    assert.equal(isIssueHead(["# 件名：第3号議案のご審議について"], WORDS), false);
    assert.equal(isIssueHead(["# 第3回 研修のご案内"], WORDS), false);
    assert.equal(isIssueHead(["# Revol. 12 notes"], WORDS), false);
    assert.equal(isIssueHead([], WORDS), false);
    assert.equal(isIssueHead(["第12号"], []), false);
  });

  it("takes each lexicon entry's form, with … for the number, and skips a form without it", () => {
    const entries = [{ pattern: "第…号" }, { pattern: "Vol. …" }, { pattern: "号外" }, { pattern: "…" }, { pattern: "a…b…c" }];
    assert.deepEqual(issueWordsOf(entries), WORDS);
  });
});

// A Japanese mail magazine that numbers its issues "Vol.691" (no space after the period), opens on its topic and ends with
// the office in charge: shaped like a public safety mail. Self-written.
const VOL_ISSUE = [
  "# Vol.12 階段からの転落に注意!",
  "",
  "階段での転落事故が続いています。手すりを使い、足元を確かめてから上り下りしましょう。",
  "",
  "担当:安全課",
  "",
].join("\n");

describe("email-greeting-closing on a newsletter's issue", () => {
  it("reads Vol. written with or without a space after it as an issue number, in Japanese and English", () => {
    assert.deepEqual(variantsOf(VOL_ISSUE), []);
    assert.deepEqual(variantsOf(VOL_ISSUE.replace("Vol.12", "vol.12")), []);
    assert.deepEqual(variantsOf(VOL_ISSUE.replace("Vol.12", "Vol. 12")), []);
    assert.deepEqual(variantsOf("# Staff Newsletter Vol.12\n\nThe spring training opens in April.\n\nSign up by April 20.\n", en), []);
  });

  it("still asks for both when Vol. stands in the body, inside a word, or before a word", () => {
    assert.deepEqual(variantsOf(VOL_ISSUE.replace("# Vol.12 階段からの転落に注意!", "# 階段からの転落に注意!\n\n資料 Vol.12 を参照")), ["greeting", "closing"]);
    assert.deepEqual(variantsOf(VOL_ISSUE.replace("Vol.12", "Revol.12")), ["greeting", "closing"]);
    assert.deepEqual(variantsOf(VOL_ISSUE.replace("Vol.12 ", "Vol.12号の")), ["greeting", "closing"]);
  });

  it("asks an issue for no greeting and no closing", () => {
    assert.deepEqual(variantsOf(ISSUE), []);
    assert.deepEqual(variantsOf("# Staff Newsletter, Vol. 12\n\nThe spring training opens in April.\n\nSign up by April 20.\n", en), []);
  });

  it("still asks a letter without an issue number for both", () => {
    assert.deepEqual(variantsOf(LETTER), ["greeting", "closing"]);
    assert.deepEqual(variantsOf(LETTER.replace("# 研修のご案内", "# 第3号議案のご案内")), ["greeting", "closing"]);
    assert.deepEqual(variantsOf(LETTER.replace("# 研修のご案内", "件名：議案 第3号")), ["greeting", "closing"]);
    assert.deepEqual(variantsOf("Subject: Citation to Vol. 12\n\nPlease review the attached report.\n\nThe figures are final.\n", en), ["greeting", "closing"]);
    assert.deepEqual(variantsOf("# Spring training\n\nThe spring training opens in April.\n\nSign up by April 20.\n", en), ["greeting", "closing"]);
  });
});
