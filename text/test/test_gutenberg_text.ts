import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { gutenbergText } from "../scripts/gutenberg-text.ts";
import { storedText, type DocEntry } from "../scripts/corpus-docs.ts";

// Project Gutenberg の eBook から作品だけを取り出す。例文はすべて自作。

const HEADER = "The Project Gutenberg eBook of A Test\r\n\r\nTitle: A Test\r\n\r\n*** START OF THE PROJECT GUTENBERG EBOOK A TEST ***\r\n";
const FOOTER = "*** END OF THE PROJECT GUTENBERG EBOOK A TEST ***\r\n\r\nSection 1. General Terms of Use\r\n";

describe("gutenbergText: 印のあいだの作品だけを残す", () => {
  it("見出しの前置きと末尾のライセンスを落とし、改行を LF にする", () => {
    const fetched = `${HEADER}\r\n\r\n\r\nA Test\r\n\r\nOne line of the work,\r\nwrapped.\r\n\r\n${FOOTER}`;
    assert.equal(gutenbergText(fetched), "A Test\n\nOne line of the work,\nwrapped.\n");
  });

  it("古い版の印（THIS PROJECT GUTENBERG EBOOK、*** の後ろに空白が無い）も読む", () => {
    const fetched = "Header\n***START OF THIS PROJECT GUTENBERG EBOOK OLD ***\nBody.\n***END OF THIS PROJECT GUTENBERG EBOOK OLD ***\nLicence\n";
    assert.equal(gutenbergText(fetched), "Body.\n");
  });

  it("始まりの印の直後の制作者の段落（Produced by …）を落とす。本文の中の同じ言葉は残す", () => {
    assert.equal(gutenbergText(`${HEADER}\n\nProduced by A Volunteer\nand Another\n\n\nA Poem\n${FOOTER}`), "A Poem\n");
    assert.equal(gutenbergText(`${HEADER}A Poem\n\nProduced by the author.\n${FOOTER}`), "A Poem\n\nProduced by the author.\n");
  });

  it("作品の行頭の字下げは残す", () => {
    assert.equal(gutenbergText(`${HEADER}\n    A verse,\n    indented.\n${FOOTER}`), "    A verse,\n    indented.\n");
  });

  it("終わりの印が無ければ始まりの印から最後まで、印がどちらも無ければ全部", () => {
    assert.equal(gutenbergText(`${HEADER}Body only.\n`), "Body only.\n");
    assert.equal(gutenbergText("No markers at all.\r\n"), "No markers at all.\n");
  });

  it("本文の中の印に似た文は印にしない", () => {
    const fetched = `${HEADER}He said *** START OF THE PROJECT GUTENBERG EBOOK in the middle.\nShe said *** END OF THE PROJECT GUTENBERG EBOOK too.\n${FOOTER}`;
    assert.equal(
      gutenbergText(fetched),
      "He said *** START OF THE PROJECT GUTENBERG EBOOK in the middle.\nShe said *** END OF THE PROJECT GUTENBERG EBOOK too.\n",
    );
  });

  it("空の本文は改行一つ", () => {
    assert.equal(gutenbergText(""), "\n");
    assert.equal(gutenbergText(`${HEADER}${FOOTER}`), "\n");
  });
});

describe("storedText: format が gutenberg の文書", () => {
  it("作品だけを置く", () => {
    const entry: DocEntry = {
      id: "pg",
      title: "A Test",
      genre: "blog/essay",
      language: "en",
      url: "https://www.gutenberg.org/cache/epub/1/pg1.txt",
      license: "Public domain",
      redistribute: true,
      format: "gutenberg",
    };
    assert.equal(storedText(entry, `${HEADER}Body.\n${FOOTER}`), "Body.\n");
  });
});
