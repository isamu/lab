import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { latinSpacing } from "./rule-run.ts";
import { isBoundSuffix, isJoinerSpace } from "../packages/chaff/src/latin-word-boundary.ts";
import { latinBoundaries } from "../packages/chaff/src/orthography.ts";
import type { Token } from "../packages/chaff/src/plugin.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";

// 英字の語の側で決まる境目: 日本語の句をつなぐ or の前後の空白と、PDF版の「版」の前。例文はすべて自作。

const JOINERS: ReadonlySet<string> = new Set(["or", "and", "vs", "vs."]);
const SUFFIXES: ReadonlySet<string> = new Set(["版", "化", "製", "型"]);

const tokensOf = (text: string): Token[] => ja.segment(text).sentences.flatMap((sentence) => sentence.tokens ?? []);

const joinerSpaces = (text: string, joiners = JOINERS): boolean[] =>
  latinBoundaries(text)
    .filter((boundary) => boundary.kind === "letter")
    .map((boundary) => isJoinerSpace(text, boundary, joiners));

const boundSuffixes = (text: string, tokens: readonly Token[] | undefined = tokensOf(text), base = 0): boolean[] =>
  latinBoundaries(text)
    .filter((boundary) => boundary.kind === "letter")
    .map((boundary) => isBoundSuffix(text, boundary, tokens, base, SUFFIXES));

describe("isJoinerSpace", () => {
  it("reads the spaces around a joining word between Japanese phrases", () => {
    assert.deepEqual(joinerSpaces("名前 or 一言メッセージ"), [true, true]);
    assert.deepEqual(joinerSpaces("A案 vs. B案"), [false, false, false]);
    assert.deepEqual(joinerSpaces("甲案 vs. 乙案"), [true]);
    assert.deepEqual(joinerSpaces("名前 OR 一言"), [true, true]);
  });

  it("does not read another word, a touching joiner or a word that only starts like one", () => {
    assert.deepEqual(joinerSpaces("名前 Word 一言"), [false, false]);
    assert.deepEqual(joinerSpaces("名前or一言"), [false, false]);
    assert.deepEqual(joinerSpaces("名前 orange 一言"), [false, false]);
    assert.deepEqual(joinerSpaces("A or 一言"), [false]);
    assert.deepEqual(joinerSpaces("名前 or API"), [false]);
    assert.deepEqual(joinerSpaces("名前 or 一言", new Set()), [false, false]);
  });
});

describe("isBoundSuffix", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("reads the boundary before a suffix that makes one word with the Latin word", () => {
    assert.deepEqual(boundSuffixes("PDF版をお送りします"), [true]);
    assert.deepEqual(boundSuffixes("業務のIT化を進めます"), [false, true]);
  });

  it("does not read a word that only starts with the suffix's character, another word, or without parts of speech", () => {
    assert.deepEqual(boundSuffixes("Apple製品を使います"), [false]);
    assert.deepEqual(boundSuffixes("PDFファイルをお送りします"), [false]);
    const [boundary] = latinBoundaries("PDF版です");
    assert.ok(boundary !== undefined);
    assert.equal(isBoundSuffix("PDF版です", boundary, undefined, 0, SUFFIXES), false);
    const shifted = tokensOf("PDF版です").map((token) => ({ ...token, span: { start: token.span.start + 50, end: token.span.end + 50 } }));
    assert.deepEqual(boundSuffixes("PDF版です", shifted, 50), [true]);
  });
});

describe("latin-spacing and words decided by the Latin side", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  const spacing = (source: string): string[] => latinSpacing(ja, source, "business/report");
  const BODY = "# 案内\n\n資料は Word で作り、Excel の表を付けます。図は PowerPoint で描き、最後に Google ドライブに置きます。\n\n";

  it("does not count a suffix written against the Latin word in a document that spaces", () => {
    assert.deepEqual(spacing(`${BODY}PDF版もご用意しています。\n`), []);
  });

  it("does not count the spaces around a joining word in a document that touches", () => {
    assert.deepEqual(spacing("# 案内\n\n資料はWordで作り、Excelの表を付けます。図はPowerPointで描きます。\n\n名前 or 一言メッセージを書いてください。\n"), []);
  });

  it("still counts a touching word that is not a suffix, and a spaced word that does not join", () => {
    assert.deepEqual(spacing(`${BODY}PDFファイルもご用意しています。\n`), ["英字:詰めています"]);
    assert.deepEqual(spacing("# 案内\n\n資料はWordで作り、Excelの表を付けます。図はPowerPointで描きます。\n\n名前 Slack 一言を書いてください。\n"), [
      "英字:空けています",
      "英字:空けています",
    ]);
  });
});
