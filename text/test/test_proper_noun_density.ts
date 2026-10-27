import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { isProse, namesIn } from "../packages/chaff/src/detectors/proper-noun-density.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import type { LanguageAdapter, Sentence } from "../packages/chaff/src/plugin.ts";

// 固有名詞は「名前」の数で数え、文でない行は数えない。英語の例は米国連邦準備制度の書簡（パブリックドメイン）の抜粋と自作、
// 日本語の例は総務省の会議録の形を写した自作。

const sentencesOf = (adapter: LanguageAdapter, source: string): readonly Sentence[] => buildDocument("t.md", source, adapter).sentences;

const everydayOf = (adapter: LanguageAdapter): string[] => (adapter.lexicons["everyday-name"] ?? []).map((entry) => entry.pattern);

/** The first word of each counted name. */
const namesOf = (adapter: LanguageAdapter, source: string): string[] =>
  sentencesOf(adapter, source).flatMap((sentence) => namesIn(sentence, [], everydayOf(adapter)).map((token) => token.surface));

const proseOf = (adapter: LanguageAdapter, source: string): boolean[] => sentencesOf(adapter, source).map(isProse);

const densityAt = (adapter: LanguageAdapter, source: string, level: "strict" | "normal" | "relaxed", genre = "business/report"): number =>
  runRules(buildDocument("t.md", source, adapter), loadRules(adapter.id === "ja" ? "ja" : "en"), { "proper-noun-density": level }, true, genre).findings.filter(
    (finding) => finding.rule === "proper-noun-density",
  ).length;

const repeated = (paragraph: string, times: number): string => Array.from({ length: times }, () => paragraph).join("\n\n");

describe("proper-noun-density: 名前を数える", () => {
  before(async () => {
    await en.prepare?.({ pos: true });
    await ja.prepare?.({ pos: true });
  });

  it("並んだ名前の語は 1 つの名前（Federal Deposit Insurance Corporation、Randall D. Guynn、赤堀 政明さん）", () => {
    assert.deepEqual(namesOf(en, "The Federal Deposit Insurance Corporation issued the guidance."), ["Federal"]);
    assert.deepEqual(namesOf(en, "The letter was signed by Randall D. Guynn last week."), ["Randall"]);
    assert.deepEqual(namesOf(ja, "座長には赤堀 政明さんが選ばれた。"), ["赤堀"]);
  });

  it("名前のすぐ後ろの括弧の略称は同じ名前（Office of the Comptroller of the Currency (OCC)）", () => {
    assert.deepEqual(namesOf(en, "The Comptroller of the Currency (OCC) issued the guidance."), ["Comptroller", "Currency"]);
  });

  it("引用符で囲んだ題名は 1 つの名前", () => {
    assert.deepEqual(namesOf(en, "The agencies issued the “Joint Statement on the Risk-Based Approach to Assessing Customer Relationships” last year."), [
      "Joint",
    ]);
  });

  it("引用した文は題名ではなく、名前を 1 つずつ数える", () => {
    assert.equal(namesOf(en, "She wrote, “Alice met Bob in Paris.”").length, 3);
  });

  it("月と曜日と元号は数えない", () => {
    assert.deepEqual(namesOf(en, "The board met on Tuesday, April 17, and again in May with Alice."), ["Alice"]);
    assert.deepEqual(namesOf(ja, "平成20年に金沢で開いた。"), ["金沢"]);
  });

  it("日本語の文書の英語の小文字の語は名前でない（rule、requests）", () => {
    assert.deepEqual(namesOf(ja, "日本語向けのtextlint ruleのpresetをMac OS Xで使って確かめます。"), ["Mac"]);
  });

  it("invalid: 別々の名前は別々に数える", () => {
    assert.equal(namesOf(en, "Alice Moreno from Contoso met Bob Tanaka in Seattle.").length, 4);
    assert.equal(namesOf(ja, "田中さんと佐藤さんが東京でトヨタの展示を見た。").length, 4);
  });
});

describe("proper-noun-density: 文でない行は数えない", () => {
  before(async () => {
    await en.prepare?.({ pos: true });
    await ja.prepare?.({ pos: true });
  });

  it("レターヘッド、出席者の名簿、題名の並びは文でない", () => {
    assert.ok(!proseOf(en, "BOARD OF GOVERNORS\nOF THE FEDERAL RESERVE SYSTEM\nWASHINGTON, D.C. 20551").some(Boolean));
    assert.deepEqual(proseOf(en, "Present: Margaret Ellis (Chair), David Kim (Treasurer), Susan Patel (Secretary)"), [false]);
    assert.deepEqual(proseOf(en, "SR 16-7, “Interagency Guidance to Issuing Banks on Applying Customer Identification Program Requirements”"), [false]);
    assert.deepEqual(proseOf(ja, "赤堀 政明、荒井 雅則、池田 昌健（代理）、岩本 宏"), [false]);
  });

  it("動詞のある文は文（文頭の動詞も、日本語の動詞も）", () => {
    assert.deepEqual(proseOf(en, "Reserve Banks are asked to distribute this letter."), [true]);
    assert.deepEqual(proseOf(en, "Moved by D. Kim, seconded by R. Hughes."), [true]);
    assert.deepEqual(proseOf(en, "Meet Alice Moreno at Contoso in Seattle."), [true]);
    assert.deepEqual(proseOf(ja, "金沢大学の北浦 勝氏が座長に選出された。"), [true]);
  });

  it("名前の多い文で動詞を名詞と読まれても、小文字の語があれば文", () => {
    assert.deepEqual(proseOf(en, "On Friday, Quinn Baker of Adatum flew from Denver to Austin with Rosa Mendes of Northwind."), [true]);
  });
});

describe("proper-noun-density: 文書の段", () => {
  before(async () => {
    await en.prepare?.({ pos: true });
    await ja.prepare?.({ pos: true });
  });

  // 連邦準備制度の書簡の形（パブリックドメインの SR 26-2 の抜粋）: レターヘッド、宛名、署名、取り替える書簡の題名の並び。
  const LETTERHEAD = [
    "BOARD OF GOVERNORS",
    "OF THE FEDERAL RESERVE SYSTEM",
    "WASHINGTON, D.C. 20551",
    "",
    "DIVISION OF",
    "SUPERVISION AND REGULATION",
    "",
    "TO THE OFFICER IN CHARGE OF SUPERVISION AT EACH FEDERAL RESERVE BANK",
  ].join("\n");
  const BODY = [
    "Based on supervisory experience and industry feedback since the issuance of SR 11-7, the agencies have updated the model risk management guidance to clarify model risk management principles and to emphasize a risk-based approach to model risk management that is tailored to a banking organization's model risk profile and the size and complexity of its operations.",
    "The revised guidance highlights sound principles for effective model risk management while recognizing that model risk management practices appropriately vary among banking organizations based on their specific risk profiles and model usage.",
    "Reserve Banks are asked to distribute this letter to the supervised banking organizations in their districts and to appropriate supervisory staff.",
  ].join(" ");
  const SIGNATURE = "Randall D. Guynn\nDirector\nDivision of\nSupervision and Regulation";
  const SUPERSEDES = [
    "Supersedes:",
    "",
    "SR letter 11-7, “Guidance on Model Risk Management” (April 4, 2011).",
    "",
    "SR letter 21-8, “Interagency Statement on Model Risk Management for Bank Systems Supporting Bank Secrecy Act/Anti-Money Laundering Compliance” (April 9, 2021).",
  ].join("\n");
  const LETTER = [LETTERHEAD, BODY, BODY, SIGNATURE, SUPERSEDES].join("\n\n");

  // 名前ばかりの文章（自作）。
  const CROWD = repeated(
    "Alice Moreno and Bob Tanaka from Contoso met Carol Diaz from Fabrikam in Seattle, then flew with Dave Okafor from Northwind to Boston to see Erin Walsh at Tailspin and Frank Liu at Litware.",
    12,
  );

  it("valid: レターヘッドと署名と題名の並びを持つ書簡は、どの段でも指摘しない", () => {
    assert.equal(densityAt(en, LETTER, "strict"), 0);
    assert.equal(densityAt(en, LETTER, "normal"), 0);
  });

  it("invalid: 名前ばかりの文章は、どの段でも指摘する", () => {
    assert.equal(densityAt(en, CROWD, "relaxed"), 1);
  });

  // 会議録の形（総務省の検討会の議事要旨を写した自作）: 出席者の名簿は文でない。
  const ROSTER =
    "赤堀 政明、荒井 雅則、池田 昌健（代理）、岩本 宏、大川 昌宏（代理）、大友 秀憲（代理）、川端 政信（代理）、北浦 勝、高木 清、竹垣 弘、田中 憲治、豊島 肇";
  const MINUTES_BODY =
    "事務局から、防災行政無線の現状と課題について資料に基づいて説明があった。構成員からは、整備の費用と更新の時期について質問があり、事務局が回答した。";
  const MINUTES = ["## 出席者", ROSTER, "## 議事", repeated(MINUTES_BODY, 6)].join("\n\n");
  const JA_CROWD = repeated(
    "田中さんと佐藤さんが、東京の丸の内にあるトヨタとソニーとパナソニックの展示を見てから、大阪の梅田で日立の鈴木さんと会いました。翌日は京都で任天堂の山本さんと、神戸で川崎重工の中村さんと会いました。",
    6,
  );

  it("valid: 出席者の名簿を持つ会議録は、どの段でも指摘しない", () => {
    assert.equal(densityAt(ja, MINUTES, "strict", "business/meeting-notes"), 0);
  });

  it("invalid: 名前ばかりの日本語の文章は、どの段でも指摘する", () => {
    assert.equal(densityAt(ja, JA_CROWD, "relaxed"), 1);
  });

  it("invalid: 名簿の名前を文の中に書けば数える", () => {
    const named = `${ROSTER.replaceAll("、", "さんと").replaceAll("（代理）", "")}さんが出席した。`;
    assert.equal(densityAt(ja, [repeated(named, 6), MINUTES_BODY].join("\n\n"), "relaxed", "business/meeting-notes"), 1);
  });
});
