import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { HOME_ARGS, HOME_EXAMPLES, homeCommand, isHomeScreens } from "../site/src/lib/homeExamples.ts";
import { HOME_TEXT, segmentsOf } from "../site/src/lib/homeText.ts";

// サイトの最初のページ。例の出力はビルドのときに chaff をかけて作り（scripts/home-screens.ts）、文は日英で同じ形を持つ。

const HOME = join(import.meta.dirname, "..", "site", "src", "home");

describe("segmentsOf", () => {
  it("バッククォートの間をコードにする", () => {
    assert.deepEqual(segmentsOf("run `npx chaffjs .` here"), [
      { text: "run ", code: false },
      { text: "npx chaffjs .", code: true },
      { text: " here", code: false },
    ]);
  });

  it("コードで始まり、コードで終わる", () => {
    assert.deepEqual(segmentsOf("`a` and `b`"), [
      { text: "a", code: true },
      { text: " and ", code: false },
      { text: "b", code: true },
    ]);
  });

  it("バッククォートの無い文はそのまま", () => {
    assert.deepEqual(segmentsOf("plain"), [{ text: "plain", code: false }]);
  });

  it("対になっていないバッククォートは書いたまま残す", () => {
    assert.deepEqual(segmentsOf("a ` b"), [{ text: "a ` b", code: false }]);
  });

  it("空の文は何も返さない", () => {
    assert.deepEqual(segmentsOf(""), []);
  });
});

const screen = { command: "npx chaffjs a.md", files: { "a.md": "# A\n" }, output: "0 findings" };
const allScreens = Object.fromEntries(HOME_EXAMPLES.map((example) => [example, screen]));

describe("isHomeScreens", () => {
  it("両方の言語にすべての例があれば受け取る", () => {
    assert.equal(isHomeScreens({ en: allScreens, ja: allScreens }), true);
  });

  it("一つの言語が欠けていれば受け取らない", () => {
    assert.equal(isHomeScreens({ en: allScreens }), false);
  });

  it("例が一つ欠けていれば受け取らない", () => {
    const withoutTeam = Object.fromEntries(Object.entries(allScreens).filter(([example]) => example !== "team"));
    assert.equal(isHomeScreens({ en: allScreens, ja: withoutTeam }), false);
  });

  it("出力が文字列でなければ受け取らない", () => {
    assert.equal(isHomeScreens({ en: allScreens, ja: { ...allScreens, draft: { ...screen, output: 3 } } }), false);
  });

  it("オブジェクトでないものは受け取らない", () => {
    [null, undefined, "x", [], 1].forEach((value) => assert.equal(isHomeScreens(value), false));
  });
});

describe("最初のページの例", () => {
  it("どの例も、見せる文書が site/src/home/<言語>/<例>/ にある", () => {
    const missing = (["en", "ja"] as const).flatMap((lang) =>
      HOME_EXAMPLES.map((example) => join(lang, example, HOME_ARGS[lang][example].at(-1) ?? "")).filter((path) => !existsSync(join(HOME, path))),
    );
    assert.deepEqual(missing, []);
  });

  it("コマンドは npx chaffjs に引数を続けたもの", () => {
    assert.equal(homeCommand(["--compact", "a.md"]), "npx chaffjs --compact a.md");
  });
});

describe("最初のページの文", () => {
  it("日本語と英語で、並べるものの数が同じ", () => {
    const counts = (lang: "en" | "ja") =>
      Object.fromEntries(Object.entries(HOME_TEXT[lang]).flatMap(([key, value]) => (Array.isArray(value) ? [[key, value.length]] : [])));
    assert.deepEqual(counts("ja"), counts("en"));
  });

  it("日本語と英語で、比べる道具と案内するページが同じ", () => {
    assert.deepEqual(
      HOME_TEXT.ja.compare.map((other) => other.url),
      HOME_TEXT.en.compare.map((other) => other.url),
    );
    assert.deepEqual(
      HOME_TEXT.ja.tools.map((tool) => tool.guide),
      HOME_TEXT.en.tools.map((tool) => tool.guide),
    );
  });
});
