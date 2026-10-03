import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { hostOf, isFileNameAlt, isUrlText, mismatchedHost } from "../packages/chaff/src/link-shape.ts";

// The shapes of links and images: a bare URL among worded links, link text showing another site, a file name as alt text.
// Every example is self-written.

const run =
  (rule: string) =>
  (source: string, adapter = ja, path = "a.md"): readonly string[] =>
    namedRuleRun(rule, `${source}\n`, adapter, path).findings;

const bareUrl = run("bare-url-mix");
const mismatch = run("link-text-url-mismatch");
const fileAlt = run("image-file-name-alt");

const WORDED_JA =
  "導入は[導入の手引き](https://example.com/setup)、設定は[設定の一覧](https://example.com/settings)、料金は[料金表](https://example.com/pricing)にあります。";
const WORDED_EN =
  "Setup is in [the setup guide](https://example.com/setup), options in [the settings list](https://example.com/settings), prices on [the pricing page](https://example.com/pricing).";

describe("bare-url-mix: a bare URL among worded links", () => {
  it("reports the one bare URL in a document of worded links", () => {
    assert.deepEqual(bareUrl(`${WORDED_JA}\n\n問い合わせは https://example.com/contact から送れます。`), [
      "URL「https://example.com/contact」がそのまま書かれています（言葉のリンクが 3 個ある文書）",
    ]);
    assert.deepEqual(bareUrl(`${WORDED_EN}\n\nSend questions through https://example.com/contact today.`, en), [
      'The URL "https://example.com/contact" is written bare (3 worded links in this document)',
    ]);
  });

  it("does not count reference definitions, whose shown text it cannot see", () => {
    const source =
      "See [the guide][g], [the list][l] and [the prices][p].\n\n[g]: https://e.com/g\n[l]: https://e.com/l\n[p]: https://e.com/p\n\nOr https://e.com/x now.";
    assert.deepEqual(bareUrl(source, en), []);
  });

  it("does not report a document with too few worded links, or one that writes its URLs bare", () => {
    assert.deepEqual(bareUrl("Read [the guide](https://e.com/g). Questions go to https://e.com/contact today.", en), []);
    const mostlyBare = `${WORDED_EN}\n\nhttps://e.com/a and https://e.com/b and https://e.com/c and https://e.com/d.`;
    assert.deepEqual(bareUrl(mostlyBare, en), []);
  });

  it("an autolink, a URL as link text, and URLs in code, quotations or a plain-text file are not bare", () => {
    assert.deepEqual(bareUrl(`${WORDED_EN}\n\nSend questions through <https://example.com/contact> today.`, en), []);
    assert.deepEqual(bareUrl(`${WORDED_EN}\n\nSend them to [https://e.com/c](https://e.com/c) today.`, en), []);
    assert.deepEqual(bareUrl(`${WORDED_EN}\n\nRun \`curl https://e.com/c\` to test.`, en), []);
    assert.deepEqual(bareUrl(`${WORDED_EN}\n\n> The old page was https://e.com/c, they said.`, en), []);
    assert.deepEqual(bareUrl(`${WORDED_EN}\n\nSend questions through https://example.com/contact today.`, en, "a.txt"), []);
  });

  it("a URL in a table cell is a value, and a destination the parser gave up on is a link", () => {
    assert.deepEqual(bareUrl(`${WORDED_EN}\n\n| Field | Example |\n| --- | --- |\n| callback | https://e.com/hook |`, en), []);
    assert.deepEqual(bareUrl(`${WORDED_EN}\n\nSee [the history](https://e.com/commits/{{ page.path }}) too.`, en), []);
  });
});

describe("link-text-url-mismatch: link text showing another site", () => {
  it("reports a URL as text whose host differs from the target's", () => {
    assert.deepEqual(mismatch("手引きは [https://docs.example.com/guide](https://old.example.net/guide) にあります。"), [
      "リンクの言葉は「docs.example.com」ですが、行き先は「old.example.net」です",
    ]);
    assert.deepEqual(mismatch("Apply at [www.example.com/apply](https://example.org/apply) today.", en), [
      'The link text shows "example.com" but the link goes to "example.org"',
    ]);
  });

  it("does not report the same host shortened, words as text, or a relative target", () => {
    assert.deepEqual(mismatch("Code is at [github.com/a](https://github.com/a/b/tree/main).", en), []);
    assert.deepEqual(mismatch("Code is at [https://github.com/a](https://github.com/a/b/tree/main).", en), []);
    assert.deepEqual(mismatch("See [www.Example.com](https://example.com/).", en), []);
    assert.deepEqual(mismatch("See [the guide](https://other.example/guide).", en), []);
    assert.deepEqual(mismatch("See [https://e.com/guide](./guide.md).", en), []);
    assert.deepEqual(mismatch("Write `[https://a.com](https://b.com)` for a link.", en), []);
  });
});

describe("image-file-name-alt: a file name as alt text", () => {
  it("reports an alt text that is a file name or a camera's or screenshot tool's name", () => {
    assert.deepEqual(fileAlt("売上です。\n\n![IMG_2041.png](IMG_2041.png)"), ["画像の代替テキスト「IMG_2041.png」はファイルの名前です"]);
    assert.deepEqual(fileAlt("設定です。\n\n![スクリーンショット 2026-04-01 10.12.03](a.png)"), [
      "画像の代替テキスト「スクリーンショット 2026-04-01 10.12.03」はファイルの名前です",
    ]);
    assert.deepEqual(fileAlt('Sales.\n\n<img src="a.jpg" alt="DSC01234">', en), ['The image alt text "DSC01234" is a file name']);
  });

  it("does not report a description, an empty alt text, or a word that only starts like a file name", () => {
    assert.deepEqual(fileAlt("Sales.\n\n![Sales from April to June](IMG_2041.png)", en), []);
    assert.deepEqual(fileAlt("Sales.\n\n![](IMG_2041.png)", en), []);
    assert.deepEqual(fileAlt("Sales.\n\n![Screenshot of the settings screen](a.png)", en), []);
    assert.deepEqual(fileAlt("Sales.\n\n![Screenshot of the h1 and h2 headings at 200% zoom](a.png)", en), []);
    assert.deepEqual(fileAlt("> ![IMG_2041.png](IMG_2041.png)", en), []);
  });
});

describe("link-shape helpers", () => {
  it("reads an address in link text, wrapped or not", () => {
    assert.equal(isUrlText("https://e.com/a"), true);
    assert.equal(isUrlText("**www.e.com**"), true);
    assert.equal(isUrlText("`https://e.com`"), true);
    assert.equal(isUrlText("README.md"), false);
    assert.equal(isUrlText("the guide"), false);
    assert.equal(isUrlText(""), false);
  });

  it("reads the host, or nothing for what is not a web address", () => {
    assert.equal(hostOf("https://WWW.Example.com/a"), "example.com");
    assert.equal(hostOf("www.e.com/x"), "e.com");
    assert.equal(hostOf("./a.md"), undefined);
    assert.equal(hostOf("#top"), undefined);
    assert.equal(hostOf("mailto:a@e.com"), undefined);
    assert.equal(hostOf("https://"), undefined);
    assert.deepEqual(mismatchedHost("https://a.com", "https://b.com"), { shown: "a.com", target: "b.com" });
    assert.equal(mismatchedHost("https://a.com/x", "https://a.com/y"), undefined);
    assert.equal(mismatchedHost("the site", "https://b.com"), undefined);
  });

  it("reads a file name as alt text", () => {
    const prefixes = ["IMG_", "Screenshot"];
    assert.equal(isFileNameAlt("photo.JPEG", prefixes), true);
    assert.equal(isFileNameAlt("img_0042", prefixes), true);
    assert.equal(isFileNameAlt("Screenshot 2026-01-01", prefixes), true);
    assert.equal(isFileNameAlt("Screenshot of the menu", prefixes), false);
    assert.equal(isFileNameAlt("IMG_", prefixes), false);
    assert.equal(isFileNameAlt("  ", prefixes), false);
    assert.equal(isFileNameAlt("A chart", []), false);
  });
});
