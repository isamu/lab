import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// 図・表・付録の参照先が無い（dangling-figure-reference）。本文の「図3」を、行の頭に書いた図の番号（見出し・キャプション）と照らす。

const RULE = "dangling-figure-reference";

const found = (source: string, adapter: LanguageAdapter = en): string[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(adapter.id), { [RULE]: "normal" }, false, "business/report")
    .findings.filter((finding) => finding.rule === RULE)
    .map((finding) => String(finding.values["label"]));

const lines = (...text: string[]): string => ["# Report", "", ...text, ""].join("\n");

describe("dangling-figure-reference", () => {
  it("a figure referred to in the text but captioned nowhere", () => {
    const source = lines("Sales rose (see Figure 1). Costs fell, as Figure 3 shows.", "", "![chart](a.png)", "", "Figure 1: Sales by month", "");
    assert.deepEqual(found(source), ["Figure 3"]);
  });

  it("a caption at the start of a line, after Markdown marks or inside an image's text, labels the figure", () => {
    const source = lines(
      "See Figure 1, Figure 2, Table 1, Fig. 3 and Appendix A.",
      "",
      "**Figure 1.** Sales",
      "",
      "![Figure 2: Costs](b.png)",
      "",
      "Table 1 — Staff",
      "",
      "*Figure 3* Margin",
      "",
      "## Appendix A: Glossary",
    );
    assert.deepEqual(found(source), []);
  });

  it("a sentence that starts with a reference is not a caption", () => {
    assert.deepEqual(found(lines("図1　売上", "", "図3の例では、費用が減った。"), ja), ["図3"]);
    assert.deepEqual(found(lines("Figure 1: Sales", "", "Figure 3 shows that costs fell.")), ["Figure 3"]);
  });

  it("a number in a heading labels it, whatever follows it", () => {
    assert.deepEqual(found(lines("詳しくは付録Aと付録Bを見る。", "", "## 付録Aについて"), ja), ["付録B"]);
  });

  it("an abbreviation refers to the same figure as the full word", () => {
    assert.deepEqual(found(lines("See Fig. 2.", "", "Figure 1: Sales")), ["Fig. 2"]);
  });

  it("each kind is checked only when the document captions at least one of that kind", () => {
    assert.deepEqual(found(lines("See Table 4 and Figure 2.", "", "Figure 1: Sales")), ["Figure 2"]);
    assert.deepEqual(found(lines("See Figure 2, published in last year's report.")), []);
  });

  it("a figure of another document is not looked for in this one", () => {
    assert.deepEqual(found(lines("As Figure 5 of the 2024 report shows, costs rose. Figure 1 shows ours.", "", "Figure 1: Costs")), []);
    assert.deepEqual(found(lines("See Table 9 in the annual report.", "", "Table 1: Staff")), []);
  });

  it("a sub-figure is labelled by its figure", () => {
    assert.deepEqual(found(lines("See Figure 1a and Figure 1(b).", "", "Figure 1: Sales")), []);
  });

  it("a Japanese figure and table, and a statute's 別表第一", () => {
    const source = lines("売上は図1のとおり伸びた。内訳は表2に示す。", "", "図1　売上の推移", "", "表1　部門別の人数");
    assert.deepEqual(found(source, ja), ["表2"]);
    assert.deepEqual(found(lines("手数料は別表第二に定める。", "", "別表第一（第二条関係）"), ja), ["別表第二"]);
    assert.deepEqual(found(lines("手数料は別表第一に定める。", "", "別表第一（第二条関係）"), ja), []);
  });

  it("a label inside a longer word is not a reference (地図3, 一覧表2), nor another law's table (法別表第二)", () => {
    const source = lines("地図3と一覧表2を見る。手数料は法別表第二による。", "", "図1　売上", "", "表1　人数", "", "別表第一（第二条関係）");
    assert.deepEqual(found(source, ja), []);
  });

  it("a 別表 written after another instrument's name or promulgation number is that instrument's", () => {
    const cited = (text: string): string[] => found(lines(text, "", "別表第一（第二条関係）"), ja);
    assert.deepEqual(cited("料金は、手数料の額を定める件(平成二十年厚生労働省告示第五十九号)別表第二に定める額とする。"), []);
    assert.deepEqual(cited("料金は、手数料の額(手数料基準)(平成二十年厚生労働省告示第六十号)別表第二に定める額とする。"), []);
    assert.deepEqual(cited("料金は、手数料規則の別表第三に定める額とする。"), []);
  });

  it("later numbers of the same kind in the same sentence belong to the cited instrument too", () => {
    const cited = (text: string): string[] => found(lines(text, "", "別表第一（第二条関係）"), ja);
    assert.deepEqual(cited("病院は、手数料の額を定める件(平成二十年厚生労働省告示第五十九号)別表第二から別表第四までに掲げる病院とする。"), []);
    assert.deepEqual(
      cited("物品は、物品の価格(価格基準)(平成二十年厚生労働省告示第六十号)の別表に収載された物品(別表第2に収載された物品を除く。)とする。"),
      [],
    );
  });

  it("a 別表 of this document is still looked for: in another sentence, before the citation, of another kind, or named as this one", () => {
    const cited = (text: string): string[] => found(lines(text, "", "別表第一（第二条関係）", "", "図1　様式"), ja);
    assert.deepEqual(cited("料金は、手数料規則の別表第二による。期限は別表第三による。"), ["別表第三"]);
    assert.deepEqual(cited("期限は別表第三により、料金は手数料規則の別表第二による。"), ["別表第三"]);
    assert.deepEqual(cited("料金は、手数料規則の別表第二により、様式は図2による。"), ["図2"]);
    assert.deepEqual(cited("料金は、この規則の別表第二による。"), ["別表第二"]);
    assert.deepEqual(cited("料金は、手数料規則の別表第二により、この規則の別表第三による。"), ["別表第三"]);
    assert.deepEqual(cited("料金は、手数料規則の別表第二により、本規則の別表第三及び別表第四による。"), ["別表第三", "別表第四"]);
    assert.deepEqual(found(lines("料金は、手数料規則の表示に従い、表3による。", "", "表1　料金"), ja), ["表3"]);
  });

  it("a count of figures is not a reference to one", () => {
    assert.deepEqual(found(lines("図3枚を添える。", "", "図1　売上"), ja), []);
  });

  it("a figure named as a link's text has its own destination", () => {
    assert.deepEqual(found(lines("See [Figure 2](figures.md#figure-2).", "", "Figure 1: Sales")), []);
  });

  it("a reference in code is not read", () => {
    assert.deepEqual(found(lines("```", "see Figure 9", "```", "", "Figure 1: Sales")), []);
  });
});
