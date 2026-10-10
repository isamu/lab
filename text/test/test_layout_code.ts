import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { layoutSlip, pairByScope, parseBreakdown, parseLayoutCode, type LayoutCode } from "../packages/chaff/src/structure/layout-codes.ts";
import { layoutWordsOf } from "../packages/chaff/src/detectors/layout-code.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { loadLexicons as loadJaLexicons } from "../packages/lang-ja/src/lexicons.ts";
import { loadLexicons as loadEnLexicons } from "../packages/lang-en/src/lexicons.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// layout-code-mismatch: a listing's layout code against the rooms it lists. Self-written text for fictional properties.

const JA = layoutWordsOf(loadJaLexicons());
const EN = layoutWordsOf(loadEnLexicons());

/** A code as "rooms parts" (parts as letters, - when the code says nothing about them), or none. */
const shown = (code: LayoutCode | undefined): string => {
  if (code === undefined) return "none";
  const letters = { living: "L", dining: "D", kitchen: "K" };
  const parts = code.parts === undefined ? "-" : [...code.parts].map((part) => letters[part]).join("");
  return `${code.text}: ${code.rooms} ${parts}`;
};

describe("parseLayoutCode", () => {
  it("reads a Japanese lettered code, its rooms and its L, D and K", () => {
    assert.equal(shown(parseLayoutCode("2LDK", JA)), "2LDK: 2 LDK");
    assert.equal(shown(parseLayoutCode("1K", JA)), "1K: 1 K");
    assert.equal(shown(parseLayoutCode("3DK（南向き）", JA)), "3DK: 3 DK");
    assert.equal(shown(parseLayoutCode("２ＬＤＫ", JA)), "２ＬＤＫ: 2 LDK");
  });

  it("does not count S, +S or +納戸 as a room", () => {
    assert.equal(shown(parseLayoutCode("2SLDK", JA)), "2SLDK: 2 LDK");
    assert.equal(shown(parseLayoutCode("2LDK+S", JA)), "2LDK+S: 2 LDK");
    assert.equal(shown(parseLayoutCode("2LDK＋納戸", JA)), "2LDK＋納戸: 2 LDK");
    assert.equal(shown(parseLayoutCode("2LDK+洋室", JA)), "2LDK: 2 LDK");
  });

  it("reads 1R as one room that says nothing about the kitchen", () => {
    assert.equal(shown(parseLayoutCode("1R", JA)), "1R: 1 -");
  });

  it("reads an English count of bedrooms, spaced, hyphened or joined", () => {
    assert.equal(shown(parseLayoutCode("3 bedrooms, 1 bathroom", EN)), "3 bedrooms: 3 -");
    assert.equal(shown(parseLayoutCode("Spacious 2-bed flat", EN)), "2-bed: 2 -");
    assert.equal(shown(parseLayoutCode("2BR/1BA", EN)), "2BR: 2 -");
    assert.equal(shown(parseLayoutCode("1 bedroom", EN)), "1 bedroom: 1 -");
  });

  it("reads no code without a kitchen or one-room letter, inside a word or a number, or in two different counts", () => {
    assert.equal(shown(parseLayoutCode("2L", JA)), "none");
    assert.equal(shown(parseLayoutCode("3D", JA)), "none");
    assert.equal(shown(parseLayoutCode("A2LDK", JA)), "none");
    assert.equal(shown(parseLayoutCode("2LDKS", JA)), "2LDKS: 2 LDK");
    assert.equal(shown(parseLayoutCode("2KB", JA)), "none");
    assert.equal(shown(parseLayoutCode("2LDK または 3DK", JA)), "none");
    assert.equal(shown(parseLayoutCode("2 bathrooms", EN)), "none");
    assert.equal(shown(parseLayoutCode("12.5 bedrooms", EN)), "none");
    assert.equal(shown(parseLayoutCode("", JA)), "none");
    assert.equal(shown(parseLayoutCode("Aタイプ", JA)), "none");
    assert.equal(shown(parseLayoutCode(`1${"S".repeat(10000)}K`, JA)), "none");
    assert.equal(shown(parseLayoutCode("1SSLLDK", JA)), "none");
    assert.equal(shown(parseLayoutCode(`2LDK${"+S".repeat(10000)}`, JA)), "2LDK+S+S+S: 2 LDK");
  });
});

const tally = (words: typeof JA, ...entries: string[]): string => {
  const breakdown = parseBreakdown(entries, words);
  const parts = [...breakdown.parts.keys()].join(",");
  return [String(breakdown.rooms), parts, breakdown.unclear ? "unclear" : ""].filter((part) => part !== "").join(" ");
};

describe("parseBreakdown", () => {
  it("counts the rooms of a Japanese breakdown and names its L, D and K", () => {
    assert.equal(tally(JA, "LDK 11.5帖、洋室 6帖、洋室 5帖"), "2 living,dining,kitchen");
    assert.equal(tally(JA, "洋室6帖・和室6帖・DK8帖"), "2 dining,kitchen");
    assert.equal(tally(JA, "洋室6帖×2、LDK12帖"), "2 living,dining,kitchen");
    assert.equal(tally(JA, "主寝室 8帖", "子供部屋 5帖", "キッチン 3帖"), "2 kitchen");
  });

  it("does not count storage rooms (納戸, S, サービスルーム, den, study)", () => {
    assert.equal(tally(JA, "LDK 12帖、洋室 6帖、洋室 5帖、納戸 3帖"), "2 living,dining,kitchen");
    assert.equal(tally(JA, "LDK 12帖、洋室 6帖、S 3帖"), "1 living,dining,kitchen");
    assert.equal(tally(EN, "Bedroom 1, Bedroom 2, Study, Den, Box room"), "2");
  });

  it("marks as unclear a room counted in some listings and not others, or an entry naming two kinds", () => {
    assert.equal(tally(JA, "LDK 12帖、洋室 6帖、書斎 4帖"), "1 living,dining,kitchen unclear");
    assert.equal(tally(EN, "Bedroom 1, Bedroom 2, Office"), "2 unclear");
    assert.equal(tally(EN, "Bedroom 1, Study/Bedroom 2"), "2");
    assert.equal(tally(EN, "Bedroom 1, Bedroom 2 (or study)"), "1 unclear");
  });

  it("marks as unclear an entry that names several rooms at once, in words or with a count", () => {
    assert.equal(tally(EN, "Bedroom 1 and Bedroom 2"), "0 unclear");
    assert.equal(tally(EN, "Bedroom 1, Bedrooms 2 and 3"), "1 unclear");
    assert.equal(tally(JA, "LDK 12帖、洋室2室"), "0 living,dining,kitchen unclear");
    assert.equal(tally(JA, "LDK 12帖、和室 2間"), "0 living,dining,kitchen unclear");
    assert.equal(tally(JA, "LDK 12帖、洋室 6帖、洋室 5帖"), "2 living,dining,kitchen");
  });

  it("leaves out entries it cannot name, and counts nothing in an empty list", () => {
    assert.equal(tally(EN, "Living room with kitchen, Bedroom 1, Bedroom 2, Bathroom"), "2");
    assert.equal(tally(JA, "浴室、トイレ、バルコニー"), "0");
    assert.equal(tally(JA), "0");
    assert.equal(tally(JA, ""), "0");
  });
});

const slipOf = (code: string, words: typeof JA, ...entries: string[]): string => {
  const parsed = parseLayoutCode(code, words);
  if (parsed === undefined) return "no code";
  const slip = layoutSlip(parsed, parseBreakdown(entries, words));
  if (slip === undefined) return "none";
  return slip.kind === "count" ? `count ${slip.code.rooms}/${slip.listed}` : `part ${slip.entry}`;
};

describe("layoutSlip", () => {
  it("reports a count that differs from the rooms listed, in both directions", () => {
    assert.equal(slipOf("3LDK", JA, "LDK 11.5帖、洋室 6帖、洋室 5帖"), "count 3/2");
    assert.equal(slipOf("1LDK", JA, "LDK 11.5帖、洋室 6帖、洋室 5帖"), "count 1/2");
    assert.equal(slipOf("3 bedrooms", EN, "Bedroom 1, Bedroom 2"), "count 3/2");
    assert.equal(slipOf("2BR", EN, "Bedroom 1, Bedroom 2, Bedroom 3"), "count 2/3");
  });

  it("reports an L, D or K the breakdown names and a lettered code lacks", () => {
    assert.equal(slipOf("2DK", JA, "LDK 11帖、洋室 6帖、洋室 5帖"), "part LDK 11帖");
    assert.equal(slipOf("2K", JA, "ダイニング 6帖、洋室 6帖、洋室 5帖"), "part ダイニング 6帖");
  });

  it("stays silent on a matching listing, S and storage, 1R, and an L the breakdown leaves out", () => {
    assert.equal(slipOf("2LDK", JA, "LDK 11.5帖、洋室 6帖、洋室 5帖"), "none");
    assert.equal(slipOf("2LDK+S", JA, "LDK 12帖、洋室 6帖、洋室 5帖、納戸 3帖"), "none");
    assert.equal(slipOf("2SLDK", JA, "LDK 12帖、洋室 6帖、洋室 5帖、S 3帖"), "none");
    assert.equal(slipOf("1R", JA, "洋室 8帖、キッチン"), "none");
    assert.equal(slipOf("2LDK", JA, "DK 9帖、洋室 6帖、洋室 5帖"), "none");
    assert.equal(slipOf("2 bedrooms", EN, "Bedroom 1, Bedroom 2, Study, Kitchen"), "none");
  });

  it("stays silent on a breakdown with no rooms or with an unclear room", () => {
    assert.equal(slipOf("2LDK", JA, "LDK 12帖"), "none");
    assert.equal(slipOf("3LDK", JA, "LDK 12帖、洋室 6帖、洋室 5帖、書斎 4帖"), "none");
    assert.equal(slipOf("3 bedrooms", EN, "Bedroom 1, Bedroom 2, Office"), "none");
  });
});

describe("pairByScope", () => {
  const at = (scope: number, name: string): { scope: number; name: string } => ({ scope, name });
  const pairs = (codes: { scope: number; name: string }[], lists: { scope: number; name: string }[]): string[] =>
    pairByScope(codes, lists).map(([code, list]) => `${code.name}-${list.name}`);

  it("pairs codes and breakdowns in order within each scope", () => {
    assert.deepEqual(pairs([at(1, "a"), at(2, "b")], [at(2, "y"), at(1, "x")]), ["a-x", "b-y"]);
    assert.deepEqual(pairs([at(1, "a"), at(1, "b")], [at(1, "x"), at(1, "y")]), ["a-x", "b-y"]);
  });

  it("pairs none in a scope with more codes than breakdowns or the other way round, or with none", () => {
    assert.deepEqual(pairs([at(1, "a"), at(1, "b")], [at(1, "x")]), []);
    assert.deepEqual(pairs([at(1, "a")], [at(1, "x"), at(1, "y")]), []);
    assert.deepEqual(pairs([at(1, "a")], [at(2, "x")]), []);
    assert.deepEqual(pairs([], []), []);
  });
});

before(async () => {
  await ja.prepare?.({ pos: true });
  await en.prepare?.({ pos: true });
});

const findings = (adapter: LanguageAdapter, source: string): string[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(adapter.id), {}, false, "business/press-release")
    .findings.filter((finding) => finding.rule === "layout-code-mismatch")
    .map((finding) => {
      const against = finding.variant === "part" ? ["part", finding.values["part"]] : [finding.values["listed"]];
      return [finding.line, finding.values["code"], ...against].map(String).join(" ");
    });

const fields = (...rows: string[]): string => ["# 物件", "", "| 項目 | 内容 |", "| --- | --- |", ...rows.map((row) => `| ${row} |`), ""].join("\n");

describe("layout-code-mismatch", () => {
  it("reports a key-value table whose layout and breakdown disagree, at the layout row", () => {
    assert.deepEqual(findings(ja, fields("間取り | 3LDK", "間取り詳細 | LDK 11.5帖、洋室 6帖、洋室 5帖")), ["5 3LDK 2"]);
    assert.deepEqual(findings(ja, fields("間取り | 2DK", "間取り詳細 | LDK 11帖、洋室 6帖、洋室 5帖")), ["5 2DK part LDK 11帖"]);
    const english = [
      "# Unit",
      "",
      "| Item | Details |",
      "| --- | --- |",
      "| Layout | 3 bedrooms, 1 bathroom |",
      "| Rooms | Living room, Bedroom 1, Bedroom 2 |",
      "",
    ];
    assert.deepEqual(findings(en, english.join("\n")), ["5 3 bedrooms 2"]);
  });

  it("reads labelled lines and a breakdown in brackets after the code", () => {
    assert.deepEqual(findings(ja, "# 物件\n\n- 間取り：3LDK\n- 間取り詳細：LDK 12帖・洋室 6帖・洋室 5帖\n"), ["3 3LDK 2"]);
    assert.deepEqual(findings(ja, fields("間取り | 3LDK（LDK12帖・洋室6帖・洋室5帖）")), ["5 3LDK 2"]);
    assert.deepEqual(findings(en, "# Unit\n\nLayout: 2-bed flat\n\nRooms: Bedroom 1, Bedroom 2, Bedroom 3\n"), ["3 2-bed 3"]);
  });

  it("reads a table of rooms as the breakdown", () => {
    const rooms = ["# 物件", "", "間取り：3LDK", "", "| 部屋 | 広さ |", "| --- | --- |", "| LDK | 12帖 |", "| 洋室 | 6帖 |", "| 洋室 | 5帖 |", ""];
    assert.deepEqual(findings(ja, rooms.join("\n")), ["3 3LDK 2"]);
  });

  it("pairs several listings in one page by section, and each row of a table with a layout column", () => {
    const page = [
      "# A棟",
      "",
      "間取り：2LDK",
      "",
      "間取り詳細：LDK 12帖、洋室 6帖、洋室 5帖",
      "",
      "# B棟",
      "",
      "間取り：3LDK",
      "",
      "間取り詳細：LDK 12帖、洋室 6帖、洋室 5帖",
      "",
    ];
    assert.deepEqual(findings(ja, page.join("\n")), ["9 3LDK 2"]);
    const wide = [
      "# 空室",
      "",
      "| 部屋 | 間取り | 間取り詳細 |",
      "| --- | --- | --- |",
      "| 101 | 2LDK | LDK 12帖、洋室 6帖、洋室 5帖 |",
      "| 102 | 3LDK | LDK 12帖、洋室 6帖、洋室 5帖 |",
      "",
    ];
    assert.deepEqual(findings(ja, wide.join("\n")), ["6 3LDK 2"]);
  });

  it("stays silent without a breakdown, on a matching listing, on S and storage rooms, and on unpaired listings", () => {
    assert.deepEqual(findings(ja, fields("間取り | 3LDK", "専有面積 | 70㎡")), []);
    assert.deepEqual(findings(ja, fields("間取り | 2LDK+S", "間取り詳細 | LDK 12帖、洋室 6帖、洋室 5帖、納戸 3帖")), []);
    assert.deepEqual(findings(en, "# Unit\n\nLayout: 2 bedrooms\n\nRooms: Bedroom 1, Bedroom 2, Den\n"), []);
    assert.deepEqual(findings(en, "# Unit\n\nLayout: 2 bedrooms\n\nRooms: Bedroom 1 and Bedroom 2\n"), []);
    assert.deepEqual(findings(ja, "# 物件\n\n間取り：2LDK\n\n間取り詳細：LDK 12帖、洋室2室\n"), []);
    const two = ["# 物件", "", "間取り：2LDK", "", "間取り：3LDK", "", "間取り詳細：LDK 12帖、洋室 6帖、洋室 5帖", ""];
    assert.deepEqual(findings(ja, two.join("\n")), []);
  });

  it("does not read a code or rooms in prose", () => {
    assert.deepEqual(findings(ja, "# 物件\n\n3LDKのお部屋で、洋室が二つあります。洋室 6帖と洋室 5帖です。\n"), []);
  });
});
