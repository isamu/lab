import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { reportedAcronyms } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// 大文字だけの 5 字以上の語が 2 つ並ぶもの（MIRAI SCHOOL、UNITED STATES）は、大文字で書いた名前や語で、略語ではない。
// 区の計画の名前（「MIRAI SCHOOL いたばし」）で報告されていた。例文は自作。

type Case = readonly [form: string, adapter: LanguageAdapter, source: string];
type ReportedCase = readonly [form: string, adapter: LanguageAdapter, source: string, words: readonly string[]];

describe("undefined-acronym: どちらも 5 字以上の大文字の 2 語は略語ではない", () => {
  const valid: readonly Case[] = [
    ["日本語の計画の名前", ja, "# 報告\n\n「SAKURA GARDEN みなと -計画2030-」（素案）について報告があった。"],
    ["全角の空白で区切った名前", ja, "# 報告\n\n「SAKURA　GARDEN みなと」について報告があった。"],
    ["英語の大文字の見出し語", en, "# Notes\n\nThe UNITED STATES office sent the form."],
    ["人の名前を大文字で書いたもの", en, "# Cast\n\nThe part of CECIL GRAHAM is played by a newcomer."],
  ];
  valid.forEach(([form, adapter, source]) => {
    it(`valid: ${form}`, () => assert.deepEqual(reportedAcronyms(adapter, source), []));
  });

  const reported: readonly ReportedCase[] = [
    ["略語 2 つの並び", en, "# Notes\n\nThe NIST SP series applies.", ["NIST", "SP"]],
    ["4 字の略語 2 つ", en, "# Notes\n\nThe FEMA NFIP rules apply.", ["FEMA", "NFIP"]],
    ["片方だけ 5 字", en, "# Notes\n\nThe NASDAQ OMX feed is late.", ["NASDAQ", "OMX"]],
    ["読点で区切った 5 字の略語", en, "# Notes\n\nWe follow HIPAA, FERPA every year.", ["HIPAA", "FERPA"]],
    ["名前の隣の略語", ja, "# 報告\n\nSAKURA GARDEN と JR の駅について報告があった。", ["JR"]],
  ];
  reported.forEach(([form, adapter, source, words]) => {
    it(`invalid: ${form}`, () => assert.deepEqual(reportedAcronyms(adapter, source), words));
  });
});
