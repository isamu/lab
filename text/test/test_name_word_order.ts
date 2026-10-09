import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import {
  isReordered,
  labelledSpans,
  orderNamesOf,
  quotedSpans,
  stemOf,
  titleCaseSpans,
  wordOrderVariants,
  type OrderName,
} from "../packages/chaff/src/name-word-order.ts";

// 語の順を入れ替えて書いた同じ名前（name-variant の order）。例文はすべて自作。

const variants = (source: string, adapter = en): readonly string[] => namedRuleRun("name-variant", source, adapter, "a.md").findings;

const named = (surface: string, offset: number, keys: readonly string[], anchored = true): OrderName => ({ surface, offset, keys, anchored });

describe("name-variant order: the parts", () => {
  it("quoted spans: the inside of each pair, not a quoted sentence or one too long", () => {
    assert.deepEqual(quotedSpans("まず「統計学基礎」を履修", ["「」"]), [{ start: 3, end: 8, anchored: true }]);
    assert.deepEqual(quotedSpans('the "Data Lab" course', ['""']), [{ start: 5, end: 13, anchored: true }]);
    assert.deepEqual(quotedSpans("「単位を修得したら、次に進む」", ["「」"]), []);
    assert.deepEqual(quotedSpans(`「${"あ".repeat(81)}」`, ["「」"]), []);
    assert.deepEqual(quotedSpans("「統計」", []), []);
    assert.deepEqual(quotedSpans("「統計」", ["「"]), []);
  });

  it("Title Case spans: two capitalised words or more, with small words between", () => {
    const text = "start with Foundations of Statistics in the autumn, or Statistical Foundations.";
    assert.deepEqual(
      titleCaseSpans(text, ["of", "and"]).map((span) => text.slice(span.start, span.end)),
      ["Foundations of Statistics", "Statistical Foundations"],
    );
    assert.deepEqual(titleCaseSpans("Statistics of the term", ["of", "the"]), []);
    assert.deepEqual(titleCaseSpans("only Statistics here", []), []);
    assert.deepEqual(titleCaseSpans("Texas and Florida", ["of"]), []);
  });

  it("Title Case spans: the first word of a sentence is left out, as its capital may only mark the start", () => {
    const text = "Take Data Lab first. Data Lab";
    const starts = new Set([0, 21]);
    assert.deepEqual(
      titleCaseSpans(text, [], (offset) => starts.has(offset)).map((span) => text.slice(span.start, span.end)),
      ["Data Lab", "Lab"],
    );
  });

  it("labelled spans: after a label and a colon, up to the punctuation", () => {
    const text = "前提科目：統計学基礎、ほか\nCourse: Data Lab. Then";
    assert.deepEqual(
      labelledSpans(text, ["前提科目", "Course"]).map((span) => text.slice(span.start, span.end)),
      ["統計学基礎", "Data Lab"],
    );
    assert.deepEqual(labelledSpans("Course: Data Lab", ["Course"]), [{ start: 8, end: 16, anchored: true, clipped: true }]);
    assert.deepEqual(labelledSpans("Recourse: none", ["Course"]), []);
    assert.deepEqual(labelledSpans("前提科目：統計", []), []);
  });

  it("stems: the longest listed ending, never leaving fewer than four letters", () => {
    const suffixes = ["s", "ics", "ical", "al"];
    assert.equal(stemOf("Statistics", suffixes), "statist");
    assert.equal(stemOf("Statistical", suffixes), "statist");
    assert.equal(stemOf("Foundations", suffixes), "foundation");
    assert.equal(stemOf("Gas", suffixes), "gas");
    assert.equal(stemOf("基礎", suffixes), "基礎");
    assert.equal(stemOf("Lab", []), "lab");
  });

  it("names from spans: the content words inside, one name for one place, anchored when any span is", () => {
    const words = [
      { start: 0, end: 2, key: "基礎" },
      { start: 2, end: 4, key: "統計" },
      { start: 4, end: 5, key: "学" },
    ];
    assert.deepEqual(
      orderNamesOf(
        "基礎統計学",
        [
          { start: 0, end: 5 },
          { start: 0, end: 5, anchored: true },
        ],
        words,
      ),
      [{ offset: 0, surface: "基礎統計学", keys: ["基礎", "統計", "学"], anchored: true }],
    );
    assert.deepEqual(orderNamesOf("基礎統計学", [{ start: 0, end: 5 }], words), [
      { offset: 0, surface: "基礎統計学", keys: ["基礎", "統計", "学"], anchored: false },
    ]);
    assert.deepEqual(orderNamesOf("基礎統計学", [{ start: 7, end: 9 }], words), []);
    assert.deepEqual(
      orderNamesOf(
        "基礎統計学",
        [
          { start: 0, end: 4 },
          { start: 0, end: 5, anchored: true },
        ],
        words,
      ).map((name) => name.surface),
      ["基礎統計学"],
    );
  });

  it("a clipped span ends before the first stop after its first word; other spans run to their end", () => {
    const text = "統計学基礎を履修";
    const words = [
      { start: 0, end: 2, key: "統計" },
      { start: 2, end: 3, key: "学" },
      { start: 3, end: 5, key: "基礎" },
      { start: 6, end: 8, key: "履修" },
    ];
    assert.deepEqual(orderNamesOf(text, [{ start: 0, end: 8, clipped: true }], words, [5])[0]?.surface, "統計学基礎");
    assert.deepEqual(orderNamesOf(text, [{ start: 0, end: 8 }], words, [5])[0]?.surface, "統計学基礎を履修");
    assert.deepEqual(orderNamesOf(text, [{ start: 0, end: 8, clipped: true }], words, [0])[0]?.surface, "統計学基礎を履修");
  });

  it("reordered: same words, another order, neither inside the other", () => {
    assert.equal(isReordered(named("統計学基礎", 0, ["統計", "学", "基礎"]), named("基礎統計学", 9, ["基礎", "統計", "学"])), true);
    assert.equal(isReordered(named("統計学基礎", 0, ["統計", "学", "基礎"]), named("統計学応用", 9, ["統計", "学", "応用"])), false);
    assert.equal(isReordered(named("統計学基礎", 0, ["統計", "学", "基礎"]), named("統計学基礎", 9, ["統計", "学", "基礎"])), false);
    assert.equal(isReordered(named("Data Data Lab", 0, ["data", "data", "lab"]), named("Data Lab", 9, ["data", "lab"])), false);
    assert.equal(isReordered(named("Lab Data Lab", 0, ["lab", "data", "lab"]), named("Data Lab", 9, ["data", "lab"])), false);
    assert.equal(isReordered(named("Statistics Lab", 0, ["statist", "lab"]), named("Statistical Lab", 9, ["statist", "lab"])), false);
    assert.equal(isReordered(named("統計学基礎演習", 0, ["演習", "基礎"]), named("統計学基礎", 9, ["基礎", "演習"])), false);
    assert.equal(isReordered(named("統計学基礎", 0, ["基礎", "演習"]), named("統計学基礎演習", 9, ["演習", "基礎"])), false);
  });

  it("the less used form is reported; on a tie the later one; a one-word name has no other order", () => {
    const usual = named("Foundations of Statistics", 0, ["foundation", "statist"]);
    const other = named("Statistical Foundations", 50, ["statist", "foundation"]);
    assert.deepEqual(wordOrderVariants([usual, other]), [{ name: other, usual: "Foundations of Statistics" }]);
    assert.deepEqual(wordOrderVariants([other, { ...usual, offset: 80 }, { ...usual, offset: 90 }]), [{ name: other, usual: "Foundations of Statistics" }]);
    assert.deepEqual(wordOrderVariants([named("Lab", 0, ["lab"]), named("Lab", 9, ["lab"])]), []);
    assert.deepEqual(wordOrderVariants([]), []);
  });

  it("two names neither written as a name (only Title Case) are compared only when one is a whole table cell", () => {
    const usual = named("Supreme Court of Florida", 0, ["supreme", "court", "florida"], false);
    const other = named("Florida Supreme Court", 50, ["florida", "supreme", "court"], false);
    assert.deepEqual(wordOrderVariants([usual, other]), []);
    assert.deepEqual(wordOrderVariants([usual, other], new Set(["Supreme Court of Florida"])), [{ name: other, usual: "Supreme Court of Florida" }]);
    assert.deepEqual(wordOrderVariants([usual, other], new Set(["Florida Supreme Court"])), [{ name: other, usual: "Supreme Court of Florida" }]);
    assert.deepEqual(wordOrderVariants([usual, { ...other, anchored: true }]), [{ name: { ...other, anchored: true }, usual: "Supreme Court of Florida" }]);
  });
});

describe("name-variant order: through the rule", () => {
  before(async () => {
    await en.prepare?.({ pos: true });
    await ja.prepare?.({ pos: true });
  });

  it("a course name in 「」 with its words reordered", () => {
    const found = variants(
      "「データ分析入門」は、「統計学基礎」の単位を修得してから履修してください。\n\n1年次の学生は、まず「基礎統計学」を履修してください。\n",
      ja,
    );
    assert.deepEqual(found, ["「基礎統計学」は、ほかの所では語の順を入れ替えた「統計学基礎」と書いています"]);
  });

  it("a Title Case course name with its words reordered, when the table lists it", () => {
    const found = variants(
      "| Course | Credits |\n| --- | --- |\n| Foundations of Statistics | 2 |\n\nTake Introduction to Data Analysis only after you pass Foundations of Statistics.\n\nFirst-year students should start with Statistical Foundations in the autumn term.\n",
    );
    assert.deepEqual(found, ['"Statistical Foundations" is written "Foundations of Statistics", with the words in another order, elsewhere in the document']);
  });

  it("silent for two courses that share words, and for a name inside a longer one", () => {
    assert.deepEqual(variants("まず「統計学基礎」を履修し、次に「統計学応用」を履修してください。\n", ja), []);
    assert.deepEqual(variants("まず「統計学」を学び、次に「統計学基礎演習」に進みます。\n", ja), []);
    assert.deepEqual(variants("Take Foundations of Statistics first, then Applied Statistics.\n"), []);
  });

  it("a name after a label, up to the first word outside the name", () => {
    assert.deepEqual(variants("前提科目：統計学基礎を履修してください。\n\n別欄では「基礎統計学」とします。\n", ja), [
      "「基礎統計学」は、ほかの所では語の順を入れ替えた「統計学基礎」と書いています",
    ]);
  });

  it("an English name after a label keeps its small words", () => {
    assert.deepEqual(variants("Prerequisite: Foundations of Statistics\n\nFirst-year students start with Statistical Foundations.\n"), [
      '"Statistical Foundations" is written "Foundations of Statistics", with the words in another order, elsewhere in the document',
    ]);
  });

  it("silent for reordered words that are not written as names", () => {
    assert.deepEqual(variants("We analyse the data first. The data we analyse comes from the survey.\n"), []);
    assert.deepEqual(variants("The Florida Supreme Court agreed. The Supreme Court of Florida later ruled.\n"), []);
    assert.deepEqual(variants("Storms hit Texas and Florida. Florida and Texas recovered.\n"), []);
    assert.deepEqual(variants("Project Plan is attached. Plan Project next.\n"), []);
    assert.deepEqual(variants('Fassig wrote "Hurricanes of the West Indies". Mitchell wrote "West Indies Hurricanes and other Tropical Cyclones".\n'), []);
    assert.deepEqual(variants("統計学の基礎を学び、基礎の統計学を応用します。\n", ja), []);
  });
});
