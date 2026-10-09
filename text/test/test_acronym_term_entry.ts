import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { reportedAcronyms } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

// 略語の用語集では、見出し語が略語で、そのすぐ後ろ（次の行・隣のセル・区切りの後ろ）に名前を書く。
// 名前の文字が略語と揃うときだけ説明済みと読む。例文は自作と、米国立気象局（NWS）の用語集（パブリックドメイン）の項目。

/** 見出し語の項目のあとに、同じ略語を本文で使う文書。 */
const withUse = (entry: string, acronym = "AFD"): string => `# Glossary\n\n${entry}\n\nForecasters read the ${acronym} every morning.\n`;

/** [何の形か, 項目, 見る略語]。 */
type Case = readonly [string, string, string];

const DEFINED: readonly Case[] = [
  ["見出しと次の段落", "## AFD\n\nArea Forecast Discussion. A text product issued by forecasters.", "AFD"],
  ["見出しと次の段落、名前のあとにハイフン", "### AFD\n\nArea Forecast Discussion - a product issued by forecasters.", "AFD"],
  ["見出しの閉じる #", "## AFD ##\n\nArea Forecast Discussion", "AFD"],
  ["略語だけの段落と次の段落", "AFD\n\nArea Forecast Discussion", "AFD"],
  ["略語だけの行と次の行", "AFD\nArea Forecast Discussion", "AFD"],
  ["略語だけの段落と、空行を 2 つ挟んだ次の段落", "AFD\n\n\nArea Forecast Discussion", "AFD"],
  ["強調した略語だけの段落", "**AFD**\n\nArea Forecast Discussion", "AFD"],
  ["強調した略語とコロンだけの行", "**AFD:**\nArea Forecast Discussion", "AFD"],
  ["見出しの略語とコロン", "## AFD:\n\nArea Forecast Discussion", "AFD"],
  ["定義リストの書き方（次の行がコロンで始まる）", "AFD\n: Area Forecast Discussion", "AFD"],
  ["強調した略語とコロン", "**AFD**: Area Forecast Discussion", "AFD"],
  ["強調の中のコロン", "**AFD:** Area Forecast Discussion", "AFD"],
  ["強調した略語と、区切りの無い名前", "**AFD** Area Forecast Discussion", "AFD"],
  ["表の行、略語のあとのセル", "| Term | Meaning |\n| --- | --- |\n| AFD | Area Forecast Discussion |", "AFD"],
  ["表の行、略語の前のセル", "| Meaning | Term |\n| --- | --- |\n| Area Forecast Discussion | AFD |", "AFD"],
  ["表の行、強調した略語", "| Term | Meaning |\n| --- | --- |\n| **AFD** | Area Forecast Discussion. A text product. |", "AFD"],
  ["箇条書き、ダッシュ", "- AFD — Area Forecast Discussion", "AFD"],
  ["箇条書き、コロン", "- AFD: Area Forecast Discussion", "AFD"],
  ["箇条書き、空白で挟んだハイフン", "* AFD - Area Forecast Discussion", "AFD"],
  ["番号付きの箇条書き", "1. AFD: Area Forecast Discussion", "AFD"],
  ["箇条書き、強調した略語", "- **AFD**: Area Forecast Discussion", "AFD"],
  ["コードの囲みが閉じた後の箇条書き", "```\nAFD: Area Forecast Discussion\n```\n\n- AFD: Area Forecast Discussion", "AFD"],
  ["小文字の語を含む名前（すべての語の頭文字）", "- AOA: At or above", "AOA"],
  ["読点を含む名前", "- ARAM: Aviation, Range, and Aerospace Meteorology", "ARAM"],
  ["名前の後ろに読点で説明が続く", "- AFD: Area Forecast Discussion, the Product of a forecast office", "AFD"],
  ["1 語を縮めた略語", "- ABV: Above", "ABV"],
  ["1 語を縮めた略語、字を飛ばす", "- ABNDT: Abundant", "ABNDT"],
];

const REPORTED: readonly Case[] = [
  ["展開がどこにも無い", "Forecasters also read the forecast.", "AFD"],
  ["見出しの次の段落が名前でない", "## AFD\n\nA text product issued by forecasters.", "AFD"],
  ["見出しに略語のほかの語がある", "## AFD products\n\nArea Forecast Discussion", "AFD"],
  ["名前がすぐ後ろでない（1 段落あいだに挟む）", "## AFD\n\nA text product.\n\nArea Forecast Discussion is its name.", "AFD"],
  ["名前の語が余る", "- AFD: Area Forecast Discussion Product", "AFD"],
  ["名前の語が足りない", "- AFD: Area Forecast", "AFD"],
  ["読点の前の語が足りない", "- AFD: Area Forecast, Discussion Product", "AFD"],
  ["略語が行の頭にない", "- The AFD: Area Forecast Discussion", "AFD"],
  ["文の途中のコロン", "Forecasters read the AFD: Area Forecast Discussion.", "AFD"],
  ["区切りの無い、強調していない略語", "- AFD Area Forecast Discussion", "AFD"],
  ["印の無い行頭の略語とコロン（メモの見出しにも書く）", "RTO: Review ticket ownership.", "RTO"],
  ["印の無い略語とコロンだけの行と次の行（メモの見出しにも書く）", "RTO:\nReview ticket ownership.", "RTO"],
  ["コードの囲みの中の項目", "```yaml\nAFD: Area Forecast Discussion\n```", "AFD"],
  ["字下げしたコードの中の項目", "Run this:\n\n    - AFD: Area Forecast Discussion", "AFD"],
  ["語の付いた記号の行はコードの囲みを閉じない", "```md\n```ts\nAFD\nArea Forecast Discussion\n```", "AFD"],
  ["短い記号の並びはコードの囲みを閉じない", "````\n```\nAFD\nArea Forecast Discussion\n````", "AFD"],
  ["チルダのコードの囲みの中の略語だけの行", "~~~\nAFD\n\nArea Forecast Discussion\n~~~", "AFD"],
  ["表で名前が隣のセルでない", "| Term | Use | Meaning |\n| --- | --- | --- |\n| AFD | issued daily | Area Forecast Discussion |", "AFD"],
  ["表のセルに略語のほかの語がある", "| Term | Meaning |\n| --- | --- |\n| AFD text | Area Forecast Discussion |", "AFD"],
  ["見出しの次が同じ略語", "## AFD\n\nAFD.", "AFD"],
  ["1 語の名前で文字が足りない", "- ACCUMS: accumulation", "ACCUMS"],
  ["1 語の名前が略語の頭の文字で始まらない", "- BV: Above", "BV"],
];

describe("略語の用語集：見出し語のすぐ後ろの名前", () => {
  DEFINED.forEach(([form, entry, acronym]) => {
    it(`valid: ${form}`, () => assert.deepEqual(reportedAcronyms(en, withUse(entry, acronym)), [], entry));
  });

  REPORTED.forEach(([form, entry, acronym]) => {
    it(`invalid: ${form}`, () => assert.deepEqual(reportedAcronyms(en, withUse(entry, acronym)), [acronym], entry));
  });

  it("front matter の中の項目は見出し語と読まない", () => {
    const source = "---\n- AFD: Area Forecast Discussion\n---\n\n# Notes\n\nForecasters read the AFD every morning.\n";
    assert.deepEqual(reportedAcronyms(en, source), ["AFD"]);
  });

  it("閉じていない front matter は front matter と読まない", () => {
    const source = "---\n\n- AFD: Area Forecast Discussion\n\nForecasters read the AFD every morning.\n";
    assert.deepEqual(reportedAcronyms(en, source), []);
  });

  it("NWS の用語集：見出し語は説明済み、名前の中の略語は数える", () => {
    const source = [
      "Here are the results for the letter a",
      "AAWU",
      "Alaskan Aviation Weather Unit",
      "ABT",
      "About",
      "ADAS",
      "Automated Data Acquisition System",
      "AFD",
      "Area Forecast Discussion - This National Weather Service product is intended to provide a well-reasoned discussion.",
      "ALERT",
      "Automated Local Event Reporting in Real Time. Network of automatic raingauges that transmit via VHF radio link.",
      "",
    ].join("\n\n");
    assert.deepEqual(reportedAcronyms(en, source, "docs/glossary"), ["ALERT", "VHF"]);
  });

  it("日本語の用語集：英語の名前は揃えば説明済み、日本語の名前は確かめられない", () => {
    assert.deepEqual(reportedAcronyms(ja, "# 用語集\n\n## SLA\n\nService Level Agreement。サービス品質の約束。\n\nSLA を結ぶ。\n"), []);
    assert.deepEqual(reportedAcronyms(ja, "# 用語集\n\n## SLA\n\nサービス品質の約束。\n\nSLA を結ぶ。\n"), ["SLA"]);
  });
});

/** 名前で確かめられる見出し語が揃った、NWS の用語集（パブリックドメイン）の項目。これだけあれば用語集と読む。 */
const NAMED_ENTRIES = [
  "AAWU\n\nAlaskan Aviation Weather Unit",
  "ABT\n\nAbout",
  "ABV\n\nAbove",
  "ADAS\n\nAutomated Data Acquisition System",
  "AFD\n\nArea Forecast Discussion",
];

const glossaryWith = (...entries: readonly string[]): string => ["Here are the results for the letter a", ...NAMED_ENTRIES, ...entries, ""].join("\n\n");

describe("略語の用語集：用語集では、見出し語の後ろの段落は名前でなくても定義", () => {
  [
    ["名前の文字が揃わない定義", "ADVIS\n\nIn hydrologic terms, a program which combines two methods to estimate streamflow.", "ADVIS"],
    ["名前の文字が足りない定義", "AMVER\n\nAutomated Mutual Assistance Vessel Rescue System. A system operated by the Coast Guard.", "AMVER"],
    ["見出し語が 2 語（1 文字の語と略語）", "A AMS\n\nArctic Air Mass", "AMS"],
    ["見出し語が / で並ぶ", "AMVER/SEAS\n\nA software program that generates reports.", "SEAS"],
    ["番号を付けた定義", "AC\n\n1. Abbreviation for Altocumulus, a cloud of a class.", "AC"],
  ].forEach(([form, entry, acronym]) => {
    it(`valid: ${String(form)}`, () => assert.deepEqual(reportedAcronyms(en, glossaryWith(String(entry), `Forecasters run ${String(acronym)} daily.`)), []));
  });

  [
    ["定義の中の略語", "ALERT\n\nAutomated Local Event Reporting in Real Time, sent via VHF radio link.", "VHF"],
    ["見出し語の次が見出し", "ADVIS\n\n## Next letter", "ADVIS"],
    ["見出し語の次が別の見出し語", "ADVIS\n\nAFRED\n\nAbbreviation for the A Index for Fredericksburg.", "ADVIS"],
    ["印の無い行頭の略語とコロン（メモの見出し）", "RTO: back by Friday.", "RTO"],
  ].forEach(([form, entry, acronym]) => {
    it(`invalid: ${String(form)}`, () =>
      assert.deepEqual(reportedAcronyms(en, glossaryWith(String(entry), `Forecasters run ${String(acronym)} daily.`)), [String(acronym)]));
  });

  it("invalid: 空白で並べた大文字の語（見出しや略語の並び）は見出し語ではない", () => {
    assert.deepEqual(reportedAcronyms(en, glossaryWith("XYZ QRS\n\nThese tools are used together.", "Teams run XYZ daily.")), ["XYZ", "QRS"]);
  });

  [
    ["略語だけの行と、名前でない段落", "ADVIS\n\nIn hydrologic terms, a program which estimates streamflow.", "ADVIS"],
    ["略語の見出しと、その節の本文", "### MATLAB\n\nInitial support for reading the stream format was added.", "MATLAB"],
    ["略語だけの行と、添え書き", "KGI\n\nQuarterly Minutes", "KGI"],
  ].forEach(([form, entry, acronym]) => {
    it(`invalid: 用語集でない文書の${String(form)}`, () =>
      assert.deepEqual(reportedAcronyms(en, `# Notes\n\n${String(entry)}\n\nThe team uses ${String(acronym)} daily.\n`), [String(acronym)]));
  });
});

/** 名前を添えた箇条書きの見出し語が揃った文書。箇条書きの書き方の用語集。 */
const LISTED_ENTRIES = [
  "- AAWU: Alaskan Aviation Weather Unit",
  "- ABT: About",
  "- ABV: Above",
  "- ADAS: Automated Data Acquisition System",
  "- AFD: Area Forecast Discussion",
];

const listWith = (...lines: readonly string[]): string => ["# Glossary", LISTED_ENTRIES.join("\n"), ...lines, ""].join("\n\n");

describe("略語の用語集：見出し語の書き方ごとに、用語集かを数える", () => {
  [
    ["強調した見出し語とコロン", "**ADVIS**: In hydrologic terms, a program which estimates streamflow.", "ADVIS"],
    ["箇条書きの見出し語とダッシュ", "- ADVIS — a program which estimates streamflow.", "ADVIS"],
  ].forEach(([form, entry, acronym]) => {
    it(`valid: ${String(form)}`, () => assert.deepEqual(reportedAcronyms(en, listWith(String(entry), `Forecasters run ${String(acronym)} daily.`)), []));
  });

  it("invalid: 箇条書きの用語集でも、略語だけの行の後ろの段落は定義と読まない", () => {
    assert.deepEqual(reportedAcronyms(en, listWith("XYZ\n\nThese tools are used together.", "Teams run XYZ daily.")), ["XYZ"]);
  });

  it("invalid: 名前を添えた見出し語が足りなければ、箇条書きの後ろの定義は名前を求める", () => {
    const source = ["# Notes", LISTED_ENTRIES.slice(1).join("\n"), "- ADVIS — a program which estimates streamflow.", "Forecasters run ADVIS daily.", ""].join(
      "\n\n",
    );
    assert.deepEqual(reportedAcronyms(en, source), ["ADVIS"]);
  });
});
