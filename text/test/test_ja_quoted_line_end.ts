import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { splitAtQuotedLineEnds } from "../packages/lang-ja/src/quoted-line-stop.ts";

// 句点で閉じた引用が行の終わりにあるとき（「…。」の後で改行）、次の行は別の文。例文は自作。

before(async () => {
  await ja.prepare?.({ pos: true });
});

const sentencesOf = (text: string): string[] => ja.segment(text).sentences.map((sentence) => sentence.text.trim());

const pieces = (text: string): string[] => splitAtQuotedLineEnds(text, { start: 0, end: text.length }).map((span) => text.slice(span.start, span.end));

describe("splitAtQuotedLineEnds", () => {
  it("cuts after a closed quotation at the end of a line", () => {
    assert.deepEqual(pieces("「約束を守る。」\nこの言葉は重い。"), ["「約束を守る。」", "この言葉は重い。"]);
    assert.deepEqual(pieces("「守れたか。」  \n「誇れるか。」\n問い続けます。"), ["「守れたか。」  ", "「誇れるか。」", "問い続けます。"]);
    assert.deepEqual(pieces("『終わりだ！』\r\n次へ進む。"), ["『終わりだ！』", "次へ進む。"]);
    assert.deepEqual(pieces("【約束を守る。】\n次へ進む。"), ["【約束を守る。】", "次へ進む。"]);
  });

  it("does not cut inside a line, before と or a comma on the next line, or at the end", () => {
    assert.deepEqual(pieces("「約束を守る。」と言った。"), ["「約束を守る。」と言った。"]);
    assert.deepEqual(pieces("「約束を守る。」\nと言った。"), ["「約束を守る。」\nと言った。"]);
    assert.deepEqual(pieces("「約束を守る」\nこの言葉は重い。"), ["「約束を守る」\nこの言葉は重い。"]);
    assert.deepEqual(pieces("「約束を守る。」\n"), ["「約束を守る。」\n"]);
    assert.deepEqual(pieces(""), [""]);
  });
});

describe("ja sentences after a quotation that closes a line", () => {
  it("reads the next line as its own sentence", () => {
    assert.deepEqual(sentencesOf("「約束を守る。」\nこの言葉は重いものです。\n「守れただろうか。」\n毎日問いかけます。"), [
      "「約束を守る。」",
      "この言葉は重いものです。",
      "「守れただろうか。」",
      "毎日問いかけます。",
    ]);
  });

  it("keeps a quotation in the middle of a sentence", () => {
    assert.deepEqual(sentencesOf("彼は「約束を守る。」と言った。"), ["彼は「約束を守る。」と言った。"]);
  });
});
