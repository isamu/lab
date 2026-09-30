import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { reportedAcronyms } from "./rule-run.ts";
import { expansionAt, type DefinitionWords } from "../packages/chaff/src/detectors/acronym-expansion.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

// 括弧の最初の項目が略語で、区切りのあとに注記が続く形（Relief Act (RA; P.L. 1-1)、（DRR、Data Retention Rule））。例文はすべて自作。

const NO_WORDS: DefinitionWords = { markers: [], verbs: [] };

/** text の中の最初の acronym が、その場で説明されているか。定義の語は使わない（この形は語彙表に頼らない）。 */
const explained = (text: string, acronym: string): boolean => expansionAt(NO_WORDS)(text, acronym, text.indexOf(acronym));

/** [何の形か, 例文, 見る略語]。 */
type Case = readonly [string, string, string];

const EXPLAINED: readonly Case[] = [
  ["直前の語の頭文字、セミコロン", "The Rural Broadband Relief Act (RBRA; P.L. 999-1) extended it.", "RBRA"],
  ["直前の語の頭文字、of と年を挟む", "The Small Farm Water Act of 2031 (SFWA; P.L. 131-7) applies.", "SFWA"],
  ["直前の語の頭文字、見る語の幅いっぱい（括弧は語に数えない）", "Farm Loans and the Water Act of 2031 (FLWA; P.L. 1-1) passed.", "FLWA"],
  ["直前の語の頭文字、コンマ", "The Data Retention Rule (DRR, effective 2030) applies.", "DRR"],
  ["直前の語の頭文字、引用符に包む", "The Data Retention Rule (“DRR”; see below) applies.", "DRR"],
  ["直前の語の頭文字、& を含む略語", "The Mergers & Acquisitions Desk (M&AD; opened 2030) grew.", "M&AD"],
  ["直前の語の頭文字、全角の括弧とセミコロン", "Data Retention Rule（DRR；2030年施行）を定める。", "DRR"],
  ["区切りの後ろの語の頭文字、読点", "データ保持規則（DRR、Data Retention Rule）を定める。", "DRR"],
  ["区切りの後ろの語の頭文字、コンマ", "The retention rule (DRR, Data Retention Rule) applies.", "DRR"],
  ["区切りの後ろの語の頭文字、引用符に包む", 'The retention rule (DRR, "Data Retention Rule") applies.', "DRR"],
  ["区切りの後ろの語の頭文字、かぎ括弧に包む", "データ保持規則（DRR、「Data Retention Rule」）を定める。", "DRR"],
  ["区切りの後ろの語の頭文字、小文字の語を挟む", "データ規則（DRRA、Data Retention and Reuse Act）を読む。", "DRRA"],
];

const REPORTED: readonly Case[] = [
  ["列挙の最初の項目", "Ask a peer or material (MR, handbook, etc.) first.", "MR"],
  ["略語の列挙", "Staff of agencies (EPA, FDIC, GSA, and NSF: use the portal) log in.", "EPA"],
  ["括弧の最初の項目でない（直前の語の頭文字は揃う）", "The Rural Broadband Relief Act (see RBRA; P.L. 999-1) passed.", "RBRA"],
  ["直前の語の頭文字が揃わない", "The law passed in 2031 (TCJA; 2031) stands.", "TCJA"],
  ["区切りの後ろの語の頭文字が足りない", "The retention rule (DRR, Data Rule) applies.", "DRR"],
  ["区切りの後ろの語の頭文字が余る", "The retention rule (DRR, Data Retention Rule Board) applies.", "DRR"],
  ["区切りの後ろの括弧が閉じない", "データ保持規則（DRR、Data Retention Rule", "DRR"],
  ["区切りが略語の直後にない", "The Data Retention Rule (DRR data; see below) applies.", "DRR"],
  ["日本語の名前と年だけ（頭文字を確かめられない）", "データ保持規則（DRR、2030年施行）を定める。", "DRR"],
];

describe("括弧の最初の項目が略語で、区切りが続く形", () => {
  EXPLAINED.forEach(([form, text, acronym]) => {
    it(`valid: ${form}`, () => assert.ok(explained(text, acronym), text));
  });

  REPORTED.forEach(([form, text, acronym]) => {
    it(`invalid: ${form}`, () => assert.equal(explained(text, acronym), false, text));
  });

  it("本文の端でも落ちない", () => {
    assert.equal(explained("(DRR;", "DRR"), false);
    assert.equal(explained("(DRR", "DRR"), false);
    assert.equal(expansionAt(NO_WORDS)("(DRR; x)", "DRR", 50), false);
  });
});

describe("undefined-acronym: 区切りの続く形で展開した略語は指摘しない", () => {
  it("英語: 展開した略語は外れ、列挙の最初の略語は残る", () => {
    const source = "# Tax\n\nThe Rural Broadband Relief Act (RBRA; P.L. 999-1) extended it. Later the RBRA lapsed. Ask a peer (KPT, notes, etc.) first.\n";
    assert.deepEqual(reportedAcronyms(en, source), ["KPT"]);
  });

  it("日本語: 区切りの後ろで展開した略語は外れ、年だけの略語は残る", () => {
    const source = "# 規則\n\nデータ保持規則（DRR、Data Retention Rule）を定める。のちに DRR を見直す。監査規則（KPT、2030年施行）もある。\n";
    assert.deepEqual(reportedAcronyms(ja, source), ["KPT"]);
  });
});
