import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { guideLinkTarget, remarkGuideLinks } from "../site/src/lib/guideLinks.ts";

describe("サイトの Markdown: 手引きのページどうしのリンク", () => {
  const cases: readonly (readonly [string, string, string])[] = [
    ["./ 付きの名前", "./configuration", "../configuration/"],
    ["名前だけ", "configuration", "../configuration/"],
    [".md 付き", "configuration.md", "../configuration/"],
    ["./ と .md", "./getting-started.md", "../getting-started/"],
    ["見出しへのリンク", "./configuration#by_path", "../configuration/#by_path"],
    ["外のサイトは触らない", "https://github.com/isamu/lab", "https://github.com/isamu/lab"],
    ["サイトの絶対パスは触らない", "/lab/ja/rules/", "/lab/ja/rules/"],
    ["親への相対パスは触らない", "../rules/", "../rules/"],
    ["同じページの見出しは触らない", "#by_path", "#by_path"],
    ["ほかの拡張子は触らない", "./chaff.yaml", "./chaff.yaml"],
    ["大文字の名前は触らない", "./README", "./README"],
    ["空は触らない", "", ""],
  ];
  cases.forEach(([label, input, expected]) => {
    it(label, () => assert.equal(guideLinkTarget(input), expected));
  });

  it("リンクと参照定義だけを直す", () => {
    const tree = {
      type: "root",
      children: [
        { type: "paragraph", children: [{ type: "link", url: "./ci", children: [{ type: "text", value: "CI" }] }] },
        { type: "definition", url: "commands.md" },
        { type: "image", url: "./ci" },
      ],
    };
    remarkGuideLinks()(tree);
    assert.deepEqual(tree, {
      type: "root",
      children: [
        { type: "paragraph", children: [{ type: "link", url: "../ci/", children: [{ type: "text", value: "CI" }] }] },
        { type: "definition", url: "../commands/" },
        { type: "image", url: "./ci" },
      ],
    });
  });

  it("形の分からない木でも落ちない", () => {
    [null, undefined, 1, "x", { children: "x" }, { type: "link", url: 1 }].forEach((tree) => assert.doesNotThrow(() => remarkGuideLinks()(tree)));
  });
});
