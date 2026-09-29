import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { congressionalRecordToMarkdown } from "../scripts/congressional-record-markdown.ts";
import { storedText, type DocEntry } from "../scripts/corpus-docs.ts";

// govinfo の Congressional Record（<pre> の中の、字下げだけで組んだ版面）を Markdown に。例文はすべて自作。

const page = (...rows: string[]): string =>
  [
    "<html>",
    "<head>",
    "<title>Congressional Record, Volume 999 Issue 1 (Monday, January 2, 2099)</title>",
    "</head>",
    "<body><pre>",
    "[Congressional Record Volume 999, Number 1 (Monday, January 2, 2099)]",
    "[Senate]",
    "[Pages S1-S2]",
    'From the Congressional Record Online through the Government Publishing Office [<a href="https://www.gpo.gov">www.gpo.gov</a>]',
    "",
    "",
    ...rows,
    "</pre></body>",
    "</html>",
  ].join("\n");

describe("congressionalRecordToMarkdown: 字下げから段落・題・引用・並びを読む", () => {
  it("中央の行は題、2 字下げは段落の始まり、字下げの無い行は段落の続き。GPO の欄は落とす", () => {
    const html = page(
      "                          SAMPLE BILL",
      "",
      "  The PRESIDING OFFICER. The Senator from Nowhere is ",
      "recognized.",
      "  Mr. SAMPLE. Thank you.",
    );
    assert.equal(
      congressionalRecordToMarkdown(html),
      "## SAMPLE BILL\n\nThe PRESIDING OFFICER. The Senator from Nowhere is recognized.\n\nMr. SAMPLE. Thank you.\n",
    );
  });

  it("深い字下げは引用。一行目はさらに 2 字深く、そこから新しい引用の段落", () => {
    const html = page(
      "  The clerk read as follows:",
      "",
      "       A bill to test ",
      "     the converter.",
      "       Second paragraph.",
      "",
      "  Back to the floor.",
    );
    assert.equal(
      congressionalRecordToMarkdown(html),
      "The clerk read as follows:\n\n> A bill to test the converter.\n\n> Second paragraph.\n\nBack to the floor.\n",
    );
  });

  it("引用の外で引用の深さに並ぶ行は、一行ずつ並びの項目（点呼の名前）", () => {
    const html = page("                                YEAS--2", "", "     Adams", "     Baker", "", "  The bill was passed.");
    assert.equal(congressionalRecordToMarkdown(html), "## YEAS--2\n\n- Adams\n- Baker\n\nThe bill was passed.\n");
  });

  it("ページの切れ目（[[Page S2]]）で割れた段落はつなぐ", () => {
    const html = page("  The Senator said that the ", "", "[[Page S2]]", "", "work goes on.");
    assert.equal(congressionalRecordToMarkdown(html), "The Senator said that the work goes on.\n");
  });

  it("続けて並ぶ中央の行は一つの題。罫線と時刻は落とす", () => {
    const html = page(
      "          SENATE RESOLUTION 1--RECOGNIZING THE",
      "                  SAMPLE WEEK",
      "",
      "                                 ______",
      "",
      "                                {time}  1410",
      "",
      "  Text.",
    );
    assert.equal(congressionalRecordToMarkdown(html), "## SENATE RESOLUTION 1--RECOGNIZING THE SAMPLE WEEK\n\nText.\n");
  });

  it("実体参照を戻し、<a> などのタグは文字だけ残す", () => {
    const html = page('  Mr. SAMPLE. See <a href="https://example.com">the report</a> &amp; the notes.');
    assert.equal(congressionalRecordToMarkdown(html), "Mr. SAMPLE. See the report & the notes.\n");
  });

  it("本文の無い <pre> は空の文書", () => {
    assert.equal(congressionalRecordToMarkdown(page()), "");
  });

  it("<pre> の無いページ（エラーページ）は黙って空にせず、失敗させる", () => {
    assert.throws(() => congressionalRecordToMarkdown("<html><body><p>Page Not Found</p></body></html>"), /no <pre>/u);
  });

  it("manifest の format が congressional-record なら、この変換で保存する", () => {
    const entry: DocEntry = {
      id: "x",
      title: "x",
      genre: "business/meeting-notes",
      language: "en",
      url: "https://www.govinfo.gov/content/pkg/CREC-2099-01-02/html/CREC-2099-01-02-pt1-PgS1.htm",
      license: "x",
      redistribute: true,
      format: "congressional-record",
    };
    assert.equal(storedText(entry, page("  Text.")), "Text.\n");
  });
});
