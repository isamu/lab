import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { cellNameRelation, cellNamesIn, cellNameVariants, proseNamesOf, type CellName, type ProseName } from "../packages/chaff/src/table-names.ts";
import { withKnownNeighbours, type NameMention } from "../packages/chaff/src/name-variants.ts";

// 表の升の名前と、解析器が名前の一語を読み落とした所（name-variant）。例文はすべて自作。

const variants = (source: string, adapter = en): readonly string[] => namedRuleRun("name-variant", source, adapter, "a.md").findings;

const cell = (text: string, start = 0): { start: number; end: number; text: string } => ({ start, end: start + text.length, text });
const cellName = (surface: string): CellName => ({ surface, offset: 0, words: surface.split(" ") });
const proseName = (surface: string, count: number): ProseName => ({ surface, words: surface.split(" "), count });
const mention = (surface: string, offset: number): NameMention => ({ surface, offset, reading: undefined, words: surface.split(" ") });

const TABLE_EN = "| Owner | Task |\n| --- | --- |\n| Sofia Mendez | Write the procedure |\n";
const TABLE_JA = "| 担当 | 内容 |\n| --- | --- |\n| 佐々木 美保 | 手順を書く |\n";

describe("name-variant: names in table cells", () => {
  before(async () => {
    await en.prepare?.({ pos: true });
    await ja.prepare?.({ pos: true });
  });

  it("a name in a table one letter away from the name the prose uses", () => {
    assert.deepEqual(variants(`Sofia Mendes opened the meeting. Sofia Mendes will send the notes.\n\n${TABLE_EN}`), [
      '"Sofia Mendez" is one letter away from "Sofia Mendes", which the document uses more than once',
    ]);
  });

  it("表の升の名前が、本文で何度も書いた名前と一字違い", () => {
    assert.deepEqual(variants(`佐々木 美穂から説明があった。資料は佐々木 美穂が送ります。\n\n${TABLE_JA}`, ja), [
      "「佐々木 美保」は、ほかの所で何度も書いた「佐々木 美穂」と一字違いです",
    ]);
  });

  it("a table that agrees with the prose, or another person, is not reported", () => {
    assert.deepEqual(variants(`Sofia Mendez opened the meeting. Sofia Mendez will send the notes.\n\n${TABLE_EN}`), []);
    assert.deepEqual(variants(`Daniel Pierce opened the meeting. Daniel Pierce will send the notes.\n\n${TABLE_EN}`), []);
    assert.deepEqual(variants(`Sofia Mendes opened the meeting.\n\n${TABLE_EN}`), []);
    assert.deepEqual(variants(`佐々木 美穂から説明があった。\n\n${TABLE_JA}`, ja), []);
  });

  it("a first name the tagger reads as a verb is read with the surname written elsewhere", () => {
    assert.deepEqual(
      variants("Send the form to Rachel Whitford by Friday. Rachel Whitfort will reply within two weeks.\n\nQuestions: Rachel Whitford, Finance Department\n"),
      ['"Rachel Whitfort" is one letter away from "Rachel Whitford", which the document uses more than once'],
    );
  });
});

describe("the reading behind table names", () => {
  it("cellNamesIn: two to four capitalised words, or two or three CJK words with a space", () => {
    const names = cellNamesIn([
      cell(" Sofia Mendez "),
      cell("Write the procedure"),
      cell("ACME INC"),
      cell("Owner"),
      cell(" 佐々木 美保 ", 20),
      cell("佐々木美保"),
      cell("2026年10月16日"),
    ]);
    assert.deepEqual(
      names.map((name) => [name.surface, name.offset]),
      [
        ["Sofia Mendez", 1],
        ["佐々木 美保", 21],
      ],
    );
  });

  it("proseNamesOf counts each mention, and two mentions one space apart as one name too", () => {
    const source = "佐々木 美穂が来た。";
    assert.deepEqual(proseNamesOf([mention("佐々木", 0), mention("美穂", 4)], source), [
      { surface: "佐々木", words: ["佐々木"], count: 1 },
      { surface: "美穂", words: ["美穂"], count: 1 },
      { surface: "佐々木 美穂", words: ["佐々木", "美穂"], count: 1 },
    ]);
    assert.deepEqual(proseNamesOf([mention("佐々木", 0), mention("美穂", 5)], "佐々木、美穂"), [
      { surface: "佐々木", words: ["佐々木"], count: 1 },
      { surface: "美穂", words: ["美穂"], count: 1 },
    ]);
  });

  it("cellNameRelation: spelling at once; one word one letter off only against a form used twice, the cell form once", () => {
    assert.equal(cellNameRelation(cellName("Sofia mendes"), 1, proseName("Sofia Mendes", 1)), "spelling");
    assert.equal(cellNameRelation(cellName("Sofia Mendez"), 1, proseName("Sofia Mendes", 2)), "near");
    assert.equal(cellNameRelation(cellName("Sofia Mendez"), 2, proseName("Sofia Mendes", 2)), undefined);
    assert.equal(cellNameRelation(cellName("Sofia Mendez"), 1, proseName("Sofia Mendes", 1)), undefined);
    assert.equal(cellNameRelation(cellName("佐々木 美保"), 1, proseName("佐々木 美穂", 3)), "near");
    assert.equal(cellNameRelation(cellName("Ann-Marie Smith"), 1, proseName("Anne-Marie Smith", 2)), "near");
    assert.equal(cellNameRelation(cellName("O’Conner Liam"), 1, proseName("O’Connor Liam", 2)), "near");
  });

  it("cellNameRelation: two words different, other lengths, short or numbered words are other names", () => {
    assert.equal(cellNameRelation(cellName("Sara Mendez"), 1, proseName("Sofia Mendes", 3)), undefined);
    assert.equal(cellNameRelation(cellName("Mendes"), 1, proseName("Sofia Mendes", 3)), undefined);
    assert.equal(cellNameRelation(cellName("Sofia Mendes"), 1, proseName("Sofia Mendes", 3)), undefined);
    assert.equal(cellNameRelation(cellName("Room Iraq"), 1, proseName("Room Iran", 3)), undefined);
    assert.equal(cellNameRelation(cellName("第2 会議室"), 1, proseName("第1 会議室", 3)), undefined);
    assert.equal(cellNameRelation(cellName("佐々木 美保子"), 1, proseName("佐々木 美穂", 3)), undefined);
  });

  it("cellNameVariants reports each cell form once, against the most used prose form", () => {
    const reported = cellNameVariants([cellName("Sofia Mendez")], [proseName("Sofia Mendes", 3), proseName("Sofia Mended", 2)]);
    assert.deepEqual(
      reported.map(({ name, usual, kind }) => [name.surface, usual, kind]),
      [["Sofia Mendez", "Sofia Mendes", "near"]],
    );
    assert.deepEqual(cellNameVariants([cellName("Sofia Mendez"), cellName("Sofia Mendez")], [proseName("Sofia Mendes", 3)]), []);
    assert.deepEqual(
      cellNameVariants([cellName("ACME Corp")], [proseName("Acme Corp", 1), proseName("ACME Carp", 2)]).map(({ usual, kind }) => [usual, kind]),
      [["Acme Corp", "spelling"]],
    );
    assert.deepEqual(cellNameVariants([], [proseName("Sofia Mendes", 3)]), []);
  });

  it("withKnownNeighbours joins a word next to a mention when the joined form is a mention elsewhere", () => {
    const source = "to Rachel Whitford by. Rachel Whitford";
    const joined = withKnownNeighbours([mention("Whitford", 10), mention("Rachel Whitford", 23)], source);
    assert.deepEqual(
      joined.map((each) => [each.surface, each.offset]),
      [
        ["Rachel Whitford", 3],
        ["Rachel Whitford", 23],
      ],
    );
    assert.deepEqual(
      withKnownNeighbours([mention("Whitford", 10)], source).map((each) => each.surface),
      ["Whitford"],
    );
    const after = withKnownNeighbours([mention("Hurricane", 0), mention("Hurricane Floyd", 16)], "Hurricane Floyd. Hurricane Floyd");
    assert.deepEqual(
      after.map((each) => [each.surface, each.offset]),
      [
        ["Hurricane Floyd", 0],
        ["Hurricane Floyd", 16],
      ],
    );
  });
});
