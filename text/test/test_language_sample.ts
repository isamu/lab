import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { guessLanguage } from "../packages/chaff/src/detect.ts";
import { languageSample } from "../packages/chaff/src/language-sample.ts";

const JAPANESE = "キャッシュの寿命を短くすると整合性は保てる。設定は一箇所にまとめた。次の節で手順を示す。";
const ENGLISH = "Keeping the cache short preserves consistency. The settings live in one place.";
const CODE_LINES = Array.from({ length: 30 }, (_, index) => `const value${String(index)} = computeSomething(input, options);`);
const fenced = (lines: readonly string[], fence = "```"): string => [`${fence}typescript`, ...lines, fence].join("\n");

describe("guessLanguage reads the prose, not the code (#399)", () => {
  it("a Japanese article with a long code block is Japanese", () => {
    assert.equal(guessLanguage(`# 手順\n\n${JAPANESE}\n\n${fenced(CODE_LINES)}\n`).language, "ja");
    assert.equal(guessLanguage(`# 手順\n\n${JAPANESE}\n\n${fenced(CODE_LINES, "~~~")}\n`).language, "ja");
  });

  it("inline code, URLs, HTML comments and front matter do not count", () => {
    const inline = CODE_LINES.slice(0, 6)
      .map((line) => `\`${line}\``)
      .join(" ");
    const urls = Array.from({ length: 12 }, (_, index) => `https://example.com/some/long/english/path/${String(index)}`).join(" ");
    const comment = `<!-- a -> b ${CODE_LINES.join(" ")} -->`;
    const frontMatter = ["---", ...Array.from({ length: 20 }, (_, index) => `english_key_${String(index)}: some english value`), "---"].join("\n");
    assert.equal(guessLanguage(`${frontMatter}\n\n${JAPANESE}\n\n${inline}\n\n${urls}\n\n${comment}\n`).language, "ja");
  });

  it("the prose inside HTML or MDX components counts, their tags do not", () => {
    const code = fenced(CODE_LINES);
    assert.equal(guessLanguage(`<Tabs>\n${JAPANESE}\n</Tabs>\n\n${code}\n`).language, "ja");
    assert.equal(guessLanguage(`<details>\n<summary>${JAPANESE}</summary>\n\n${JAPANESE}\n</details>\n\n${code}\n`).language, "ja");
    const imports = Array.from({ length: 10 }, (_, index) => `import { Component${String(index)} } from "@site/components/component-${String(index)}";`);
    assert.equal(guessLanguage(`${imports.join("\n")}\n\n${JAPANESE}\n`).language, "ja");
    assert.equal(guessLanguage(`<div>${JAPANESE}</div>\n\n${ENGLISH}\n`).language, "ja");
  });

  it("an English article with Japanese only in its code stays English", () => {
    const japaneseCode = Array.from({ length: 30 }, () => `console.log("${JAPANESE}");`);
    assert.equal(guessLanguage(`# Steps\n\n${ENGLISH}\n\n${fenced(japaneseCode)}\n`).language, "en");
  });

  it("a document of nothing but code is still judged, from all of it", () => {
    assert.equal(guessLanguage(fenced(CODE_LINES)).language, "en");
    assert.equal(guessLanguage(fenced([JAPANESE])).language, "ja");
  });

  it("indented text in plain text is prose, not code", () => {
    const indented = [`    ${JAPANESE}`, "", `    ${JAPANESE}`].join("\n");
    assert.equal(guessLanguage(`${indented}\n\n${CODE_LINES.slice(0, 2).join("\n")}\n`).language, "ja");
  });
});

describe("languageSample", () => {
  it("keeps offsets: masked text has the same length and line breaks", () => {
    const source = `${JAPANESE}\n\n${fenced(CODE_LINES.slice(0, 2))}\n\`x\` https://example.com/a\n`;
    const sample = languageSample(source);
    assert.equal(sample.length, source.length);
    assert.equal(sample.split("\n").length, source.split("\n").length);
    assert.ok(sample.startsWith(JAPANESE));
    assert.doesNotMatch(sample, /computeSomething|example\.com|`x`/u);
  });

  it("leaves text without code untouched", () => {
    assert.equal(languageSample(JAPANESE), JAPANESE);
    assert.equal(languageSample(""), "");
  });
});
