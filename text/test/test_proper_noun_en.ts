import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { properNounChecked } from "../packages/lang-en/src/proper-noun.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

// 解析器が固有名詞と付けた語を、表記で確かめる。例文はすべて自作。

describe("properNounChecked", () => {
  it("大文字を含む語は固有名詞のまま（Chicago、HTTP、McDonald）", () => {
    ["Chicago", "HTTP", "McDonald", "iPhone"].forEach((word) => assert.equal(properNounChecked(word, "PROPN"), "PROPN"));
  });

  it("大文字の無い語は普通名詞（linters、json、e.g. の e）", () => {
    ["linters", "json", "e", "offline", "café"].forEach((word) => assert.equal(properNounChecked(word, "PROPN"), "NOUN"));
  });

  it("文字の無い語は、数字なら数、通貨や数学の記号なら記号、ほかは句読点", () => {
    assert.equal(properNounChecked("2026", "PROPN"), "NUM");
    assert.equal(properNounChecked("$", "PROPN"), "SYM");
    assert.equal(properNounChecked("+", "PROPN"), "SYM");
    assert.equal(properNounChecked("—", "PROPN"), "PUNCT");
    assert.equal(properNounChecked("", "PROPN"), "PUNCT");
  });

  it("固有名詞でない品詞には触れない", () => {
    assert.equal(properNounChecked("linters", "NOUN"), "NOUN");
    assert.equal(properNounChecked("—", "PUNCT"), "PUNCT");
    assert.equal(properNounChecked("Run", "VERB"), "VERB");
  });
});

describe("英語の文書で、大文字の無い語は固有名詞に数えない", () => {
  before(async () => {
    await en.prepare?.({ pos: true });
  });

  const propernouns = (source: string): string[] =>
    buildDocument("t.md", source, en)
      .sentences.flatMap((sentence) => sentence.tokens ?? [])
      .filter((token) => token.pos === "PROPN")
      .map((token) => token.surface);

  it("小文字の語と記号は外れ、大文字の名前は残る", () => {
    const found = propernouns("We ran the linters — offline, e.g. on json files in Chicago.");
    assert.ok(found.includes("Chicago"));
    ["linters", "—", "offline", "json", "e", "g"].forEach((word) => assert.ok(!found.includes(word), word));
  });
});
