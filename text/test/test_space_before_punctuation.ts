import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { spacesBeforePunctuation } from "../packages/chaff/src/detectors/space-before-punctuation.ts";

// 句読点の前の空白（space-before-punctuation）。例文はすべて自作。

const RULE = "space-before-punctuation";

const findingsOf = (source: string): readonly string[] => namedRuleRun(RULE, source, en).findings;

/** 空白の後ろの印。prose と source が同じ文字列のとき。 */
const marksIn = (text: string): string[] => spacesBeforePunctuation(text, text).map((space) => text.charAt(space + 1));

describe("space-before-punctuation: 句読点の前に空白がある", () => {
  it("語の後ろの空白と句点・読点", () => {
    assert.deepEqual(findingsOf("The form is ready , and the office has a copy .\n"), ['A space before ","', 'A space before "."']);
  });

  it("セミコロン・疑問符・感嘆符と、閉じの記号や行の終わりの前の句読点", () => {
    assert.deepEqual(marksIn('Is it done ? Yes ; it is ! He said "fine ." (see above .)'), ["?", ";", "!", ".", "."]);
  });

  it("コロンは欄の印として空けるので見ない", () => {
    assert.deepEqual(marksIn("Note : read this. ISSN : 1234."), []);
  });

  it("空白で区切った省略の点と目次の点線", () => {
    assert.deepEqual(marksIn("He paused . . . and left. Goals . . . . . 4. Wait .. what"), []);
  });

  it("次の語の頭の点（.NET、.5）", () => {
    assert.deepEqual(marksIn("We use .NET and a .5 mm pen."), []);
  });

  it("数の後ろ（式の [ 1 , N ]）", () => {
    assert.deepEqual(marksIn("for k in [ 1 , N ] and page 5 ."), []);
  });

  it("二つ以上の空白の後ろ（表のように並べた行）", () => {
    assert.deepEqual(marksIn("otherwise    ,\nvalue  ."), []);
  });

  it("コードと、強調の印を覆ってできた空白は数えない", () => {
    assert.deepEqual(findingsOf("Run `make all .` now. It is *done*. It is **fine**, really.\n"), []);
  });

  it("句読点が付いていれば何も言わない", () => {
    assert.deepEqual(findingsOf("The form is ready, and the office has a copy.\n"), []);
    assert.deepEqual(marksIn(""), []);
  });

  it("日本語の文書では動かず、理由を言う", () => {
    assert.deepEqual(namedRuleRun(RULE, "申込書を送ります。\n", ja).skipped, ["ja 向けの rule ではないため"]);
  });
});
