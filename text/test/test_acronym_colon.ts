import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { expansionAt, namesAcronym, type DefinitionWords } from "../packages/chaff/src/detectors/acronym-expansion.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// 括弧の中で名前と略語をコロンでつなぐ形（（single nucleotide polymorphism：SNP）、(SNP: single nucleotide polymorphism)）。
// 名前の頭文字が略語とちょうど揃うときだけ展開と読む。例文は個人情報保護委員会のガイドライン（ゲノムデータの定義）の語句と自作。

const NO_WORDS: DefinitionWords = { markers: [], verbs: [] };

const explained = (text: string, acronym: string): boolean => expansionAt(NO_WORDS)(text, acronym, text.indexOf(acronym));

/** [何の形か, 例文, 見る略語]。 */
type Case = readonly [string, string, string];

const EXPLAINED: readonly Case[] = [
  ["名前：略語、全角のコロン、小文字の語", "全ゲノム一塩基多型（single nucleotide polymorphism：SNP）データ", "SNP"],
  ["名前：略語、もう一つ", "繰り返し配列（short tandem repeat：STR）等の遺伝型情報", "STR"],
  ["名前：略語、ハイフンでつないだ語と大文字の語", "推進機構（Information-technology Promotion Agency：IPA）に設置された。", "IPA"],
  ["名前: 略語、半角のコロンと空白", "The panel (Data Retention Board: DRB) met.", "DRB"],
  ["名前：略語、大文字の語だけの頭文字（and を挟む）", "規則（Data Retention and Reuse Act：DRRA）を読む。", "DRRA"],
  ["名前：略語、略語を引用符に包む", "規則（Data Retention Rule：「DRR」）を読む。", "DRR"],
  ["略語：名前、全角のコロン", "一塩基多型（SNP：single nucleotide polymorphism）を読む。", "SNP"],
  ["略語: 名前、半角のコロン", "The panel (DRB: Data Retention Board) met.", "DRB"],
];

const REPORTED: readonly Case[] = [
  ["略語の列挙の途中", "Staff of agencies (EPA, FDIC: use the portal) log in.", "FDIC"],
  ["略語の列挙の最初", "Staff of agencies (EPA, FDIC: use the portal) log in.", "EPA"],
  ["列挙の最後の略語", "Staff of agencies (EPA, FDIC: GSA) log in.", "GSA"],
  ["列挙の項目の頭文字がたまたま揃う", "Two teams (Legal, Finance: LF) sign off.", "LF"],
  ["名前の頭文字が揃わない", "The panel (Data Board: DRB) met.", "DRB"],
  ["名前の頭文字が余る", "The panel (Data Retention Board Panel: DRB) met.", "DRB"],
  ["例示の印（例：）", "クラウド（例：AWS）を使う。", "AWS"],
  ["日本語の名前（頭文字を確かめられない）", "推進機構（情報処理推進機構：IPA）に設置された。", "IPA"],
  ["略語のあとで括弧が閉じない", "The panel (Data Retention Board: DRB and more) met.", "DRB"],
  ["コロンの前に括弧が無い", "Data Retention Board: DRB) met.", "DRB"],
  ["略語：名前、名前が数だけ", "資料（PDF：5663KB）を読む。", "PDF"],
];

describe("括弧の中でコロンが名前と略語をつなぐ形", () => {
  EXPLAINED.forEach(([form, text, acronym]) => {
    it(`valid: ${form}`, () => assert.ok(explained(text, acronym), text));
  });

  REPORTED.forEach(([form, text, acronym]) => {
    it(`invalid: ${form}`, () => assert.equal(explained(text, acronym), false, text));
  });

  it("本文の端でも落ちない", () => {
    assert.equal(explained("：SNP）", "SNP"), false);
    assert.equal(explained("（single nucleotide polymorphism：SNP", "SNP"), false);
    assert.equal(expansionAt(NO_WORDS)("（a：SNP）", "SNP", 99), false);
  });
});

describe("namesAcronym", () => {
  const cases: readonly (readonly [string, string, boolean])[] = [
    ["single nucleotide polymorphism", "SNP", true],
    ["Data Retention and Reuse Act", "DRRA", true],
    ["Mergers and Acquisitions Desk", "M&AD", true],
    ["reverse transcription polymerase chain reaction", "RT-PCR", true],
    ["internet of things", "IoT", true],
    ["“Data Retention Rule”", "DRR", true],
    ["Data Retention Rule Board", "DRR", false],
    ["Data Rule", "DRR", false],
    ["the data retention rule", "DRR", false],
    ["情報処理推進機構", "IPA", false],
    ["", "SNP", false],
    ["   ", "SNP", false],
  ];
  cases.forEach(([name, acronym, expected]) => {
    it(`${JSON.stringify(name)} / ${acronym}`, () => assert.equal(namesAcronym(name, acronym), expected));
  });
});

/** 1 個でも出す段階で、出た略語だけを返す。 */
const acronymsIn = (source: string, adapter: LanguageAdapter): string[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(adapter.id), { "undefined-acronym": "strict" }, true, "business/report")
    .findings.filter((finding) => finding.rule === "undefined-acronym")
    .map((finding) => String(finding.values["word"]));

describe("undefined-acronym: コロンで名前をつないだ略語は指摘しない", () => {
  it("日本語: 名前：略語の形の略語は外れ、例示の略語は残る", () => {
    const source =
      "# 定義\n\n全ゲノム一塩基多型（single nucleotide polymorphism：SNP）データのほか、40箇所以上のSNPから構成されるデータを含む。監査の道具（例：KPT）も使う。\n";
    assert.deepEqual(acronymsIn(source, ja), ["KPT"]);
  });

  it("英語: 略語: 名前の形の略語は外れ、列挙の略語は残る", () => {
    const source = "# Panel\n\nThe panel (DRB: Data Retention Board) met. Later the DRB closed. Staff of agencies (KPT, QRX: use the portal) log in.\n";
    assert.deepEqual(acronymsIn(source, en), ["KPT", "QRX"]);
  });
});
