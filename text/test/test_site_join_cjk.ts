import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { joinCjkLines, remarkJoinCjkLines } from "../site/src/lib/joinCjkLines.ts";

describe("サイトの Markdown: 日本語の行をつなぐ", () => {
  const cases: readonly (readonly [string, string, string])[] = [
    ["句点の後の改行", "書いた人です。\nまずは", "書いた人です。まずは"],
    ["漢字どうしの改行", "文章を\n書き換えない", "文章を書き換えない"],
    ["カタカナと全角括弧", "ルール\n（試験中）", "ルール（試験中）"],
    ["英語どうしは空白のまま", "one line\nnext line", "one line\nnext line"],
    ["日本語と英字の間は残す", "chaff は\nAPI key", "chaff は\nAPI key"],
    ["英字と日本語の間も残す", "npx chaffjs\nで動かす", "npx chaffjs\nで動かす"],
    ["空の文字列", "", ""],
    ["改行の無い文", "一文です。", "一文です。"],
    ["段落の区切りの二重改行は触らない", "前の段落。\n\n次の段落。", "前の段落。\n\n次の段落。"],
  ];
  cases.forEach(([label, input, expected]) => {
    it(label, () => assert.equal(joinCjkLines(input), expected));
  });

  it("text の節だけを直し、コードは触らない", () => {
    const tree = {
      type: "root",
      children: [
        {
          type: "paragraph",
          children: [
            { type: "text", value: "一行目。\n二行目。" },
            { type: "inlineCode", value: "a。\nb。" },
          ],
        },
        { type: "code", value: "一行目。\n二行目。" },
      ],
    };
    remarkJoinCjkLines()(tree);
    assert.deepEqual(tree, {
      type: "root",
      children: [
        {
          type: "paragraph",
          children: [
            { type: "text", value: "一行目。二行目。" },
            { type: "inlineCode", value: "a。\nb。" },
          ],
        },
        { type: "code", value: "一行目。\n二行目。" },
      ],
    });
  });

  it("形の分からない木でも落ちない", () => {
    [null, undefined, 1, "x", { children: "x" }, { type: "text", value: 1 }].forEach((tree) => assert.doesNotThrow(() => remarkJoinCjkLines()(tree)));
  });
});
