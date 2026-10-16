import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// A line under a heading that only names what the heading is about — the label of a link or an attachment a converted
// page kept as plain text, or a list named after the heading — is not a sentence restating the heading. Self-written.

const echoes = (source: string, adapter: LanguageAdapter): number => {
  const doc = buildDocument("a.md", source, adapter);
  return runRules(doc, loadRules(adapter.id), {}, false, "business/press-release").findings.filter((finding) => finding.rule === "heading-echo").length;
};

describe("heading-echo and a line that names the heading's subject", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
    await en.prepare?.({ pos: true });
  });

  it("valid: the name of the document a heading 「…について」 introduces", () => {
    assert.equal(echoes("### 図書館資料寄贈受付要領について\n\n図書館資料寄贈受付要領\n\n- 受付は窓口で行います。\n", ja), 0);
    assert.equal(echoes("## 北区役所庁舎清掃業務仕様書について\n\n北区役所庁舎清掃業務仕様書\n", ja), 0);
    assert.equal(echoes("## About the annual maintenance schedule\n\nAnnual maintenance schedule\n", en), 0);
  });

  it("valid: a list named after the heading, the heading quoted as its title", () => {
    assert.equal(echoes("## ご意見をお聞かせください\n\n「ご意見をお聞かせください」一覧\n\n## 市役所\n\n本文です。\n", ja), 0);
    assert.equal(echoes("## Tell us what you think\n\n“Tell us what you think” pages\n", en), 0);
  });

  it("invalid: a title line that copies the heading whole, or drops a word of its own", () => {
    assert.equal(echoes("### 図書館資料寄贈受付要領\n\n図書館資料寄贈受付要領\n\n本文です。\n", ja), 1);
    assert.equal(echoes("### 図書館資料寄贈受付要領の概要\n\n図書館資料寄贈受付要領\n\n本文です。\n", ja), 1);
  });

  it("invalid: a sentence that restates the heading, quoted or not", () => {
    assert.equal(echoes("### 図書館資料寄贈受付要領について\n\n図書館資料寄贈受付要領について説明します。\n", ja), 1);
    assert.equal(echoes("## ご意見をお聞かせください\n\n「ご意見をお聞かせください」について説明します。\n", ja), 1);
    assert.equal(echoes("## About the annual maintenance schedule\n\nThis section is about the annual maintenance schedule.\n", en), 1);
  });
});
