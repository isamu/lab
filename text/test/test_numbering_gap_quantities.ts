import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { prepare } from "../packages/lang-ja/src/pos.ts";
import { countedAfter, quantities } from "../packages/lang-ja/src/quantities.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { dottedNumber, isAmount } from "../packages/chaff/src/structure/universal.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import type { LanguageAdapter, StructurePatterns } from "../packages/chaff/src/plugin.ts";

// 行頭の小数が単位の記号（mM・mg・°C）や接頭詞（「本利用ルール」の「本」）に続くとき、それが通し番号か数量か。
// 例文は US 4,683,202（パブリックドメイン）とデジタル庁のコピーライトポリシー（PDL1.0）の抜き書き。

const lines = (...rows: string[]): string => rows.join("\n");

const patternsOf = (adapter: LanguageAdapter): StructurePatterns => {
  if (adapter.structure === undefined) throw new Error(`lang-${adapter.id} has no structure`);
  return adapter.structure;
};

type Gap = readonly [unknown, unknown];

const gapsOf = (adapter: LanguageAdapter, source: string): Gap[] =>
  runRules(buildDocument("c.md", source, adapter), loadRules(adapter.id), {}, true, "legal/contract")
    .findings.filter((finding) => finding.rule === "numbering-gap")
    .map((finding) => [finding.values["previous"], finding.values["label"]]);

before(async () => prepare());

describe("English: a decimal followed by a unit symbol is an amount, not a section number", () => {
  const cases: readonly (readonly [string, string, boolean])[] = [
    ["1.5", "mM in each of the four deoxyribonucleoside triphosphates", true],
    ["0.25", "mM in dithiothreitol", true],
    ["2.5", "mg/kg body weight", true],
    ["37.5", "°C for 10 minutes", true],
    ["1.2", "µL of buffer", true],
    ["1.2", "μl of buffer", true],
    ["4.5", "kDa protein", true],
    ["2.5", "%", true],
    ["1.1", "Scope", false],
    ["4.2", "Payment Terms", false],
    ["2.1", "mmap and friends", false],
    ["5.2.2", "min-fresh", false],
    ["3.1", "Molecular weight", false],
    ["2.2", "ms", true],
  ];
  cases.forEach(([number, rest, expected]) => {
    it(`${number} ${rest} → ${String(expected)}`, () => assert.equal(patternsOf(en).countedAfter?.(number, rest), expected));
  });

  it("the patent's reagent list opens no section, so 0.25 after 1.5 is no gap", () => {
    const source = lines(
      "### EXAMPLE 3",
      "",
      "The primers were dissolved in 100 μl of a solution which was:",
      "",
      "1.5 mM in each of the four deoxyribonucleoside triphosphates",
      "",
      "30 mM in Tris acetate buffer at pH 7.9",
      "",
      "0.25 mM in dithiothreitol",
    );
    assert.deepEqual(gapsOf(en, source), []);
  });

  it("a real jump in dotted sections is still reported", () => {
    const source = lines("# Terms", "", "1.1 Scope", "", "Text.", "", "1.3 Payment", "", "Text.");
    assert.deepEqual(gapsOf(en, source), [["1.1", "1.3"]]);
  });
});

describe("日本語: 小数の後ろが単位の記号なら数量、接頭詞の「本」なら見出しの番号", () => {
  const cases: readonly (readonly [string, string, boolean])[] = [
    ["1.5", "mM の塩化マグネシウム", true],
    ["1.5", "mMの塩化マグネシウム", true],
    ["37.5", "℃で 10 分保温する", true],
    ["2.5", "mg を加える", true],
    ["1.5", "本の鉛筆", true],
    ["1.5", "本を使う", true],
    ["0.5", "枚の紙", true],
    ["1.5", "枚を提出する", true],
    ["2.5", "枚分の余白", true],
    ["1.3", "各部門の役割", false],
    ["1.4", "本利用ルールが適用されないコンテンツについて", false],
    ["1.2", "本規約の適用", false],
    ["2.1", "本サービスの内容", false],
    ["2.1", "mmap の使い方", false],
  ];
  cases.forEach(([number, rest, expected]) => {
    it(`${number} ${rest} → ${String(expected)}`, () => assert.equal(patternsOf(ja).countedAfter?.(number, rest), expected));
  });

  it("行頭の「3 本の鉛筆」は数量のまま、「3 本規約」の「本」は数量にしない", () => {
    assert.equal(countedAfter("3", "本の鉛筆"), true);
    assert.equal(countedAfter("3", "本規約"), false);
    assert.equal(countedAfter("12", "両"), true);
    assert.equal(countedAfter("12", "両。"), true);
  });

  it("文中の数量は接頭詞と読める単位でも数量のまま（「10 両編成」）", () => {
    const counted = quantities("10 両編成の電車と 3 本の鉛筆。").map((mention) => [mention.attrs["value"], mention.attrs["unit"]]);
    assert.deepEqual(counted, [
      [10, "両"],
      [3, "本"],
    ]);
  });

  it("デジタル庁のコピーライトポリシー: 「1.1.」の次の「1.4 本利用ルール…」の飛びを言う", () => {
    const source = lines(
      "# コピーライトポリシー",
      "",
      "## 本サイトのコンテンツの利用に関する重要情報",
      "",
      "### 1.1. 出典の記載について",
      "",
      "出典を記載してください。",
      "",
      "### 1.4 本利用ルールが適用されないコンテンツについて",
      "",
      "以下のコンテンツについては、本利用ルールの適用を受けません。",
    );
    assert.deepEqual(gapsOf(ja, source), [["1.1", "1.4"]]);
  });

  it("続いた番号（1.1. → 1.2 本…）は飛びではない", () => {
    const source = lines("# 規約", "", "### 1.1. 出典の記載について", "", "本文。", "", "### 1.2 本規約の適用", "", "本文。");
    assert.deepEqual(gapsOf(ja, source), []);
  });

  it("試薬の並び（1.5 mM → 0.25 mM）は番号の飛びではない", () => {
    const source = lines("# 方法", "", "1.5 mM の塩化マグネシウム", "", "0.25 mM のジチオトレイトール");
    assert.deepEqual(gapsOf(ja, source), []);
  });
});

// 自作の文。点で閉じた見出しの番号（「5. 」）の後ろに単位と読める語（ページ・Days）が来ても、それは札で、数量ではない。
describe("a number closed by a dot is a label, even before a word that reads as a unit", () => {
  const heading = { open: [], isHeading: true };
  const countsEverything = (): boolean => true;
  const amountOf = (line: string): boolean | undefined => {
    const dotted = dottedNumber(line, heading);
    return dotted === undefined ? undefined : isAmount(dotted, countsEverything);
  };

  it("「5. ページ」「4.2. GB」 are labels; 「1.5 万人」「5 ページ」 may be amounts", () => {
    assert.equal(amountOf("5. ページ自身の通信から分かること"), false);
    assert.equal(amountOf("4.2. GB の上限"), false);
    assert.equal(amountOf("1.5 万人が参加した"), true);
    assert.equal(amountOf("5 ページ自身の通信"), true);
  });

  it("without a language's reading of units, nothing is an amount", () => {
    const dotted = dottedNumber("1.5 万人", heading);
    assert.ok(dotted !== undefined);
    assert.equal(isAmount(dotted, undefined), false);
  });

  it("日本語: 「### 5. ページ自身の通信から分かること」は 4 と 6 のあいだの番号で、抜けは無い", () => {
    const source = lines(
      "# 道具",
      "",
      "## 見ていること",
      "",
      "### 4. 運営元",
      "",
      "本文です。",
      "",
      "### 5. ページ自身の通信から分かること",
      "",
      "本文です。",
      "",
      "### 6. 入力するページ",
      "",
      "本文です。",
    );
    assert.deepEqual(gapsOf(ja, source), []);
  });

  it("日本語: 本当の抜け（4 の次が 6）は、点で閉じた番号でも言う", () => {
    const source = lines("# 道具", "", "### 4. 運営元", "", "本文です。", "", "### 6. ページの入力欄", "", "本文です。");
    assert.deepEqual(gapsOf(ja, source), [["4", "6"]]);
  });

  it("English: 「## 2. % of tickets closed」 is section 2, between 1 and 3", () => {
    const source = lines(
      "# Support",
      "",
      "## 1. Volume",
      "",
      "Text here.",
      "",
      "## 2. % of tickets closed",
      "",
      "Text here.",
      "",
      "## 3. Backlog",
      "",
      "Text here.",
    );
    assert.deepEqual(gapsOf(en, source), []);
  });
});
