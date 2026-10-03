import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { sharesOverHundred, type ShareWords } from "../packages/chaff/src/detectors/share-over-hundred.ts";

// 100% を超える一部の割合（share-over-hundred）。例文はすべて自作。

const RULE = "share-over-hundred";

const findingsOf = (source: string, adapter = ja): readonly string[] => namedRuleRun(RULE, source, adapter).findings;

const JA: ShareWords = {
  wholes: ["回答者", "利用者", "社員"],
  links: [
    { pattern: "の", position: "before" },
    { pattern: "のうち", position: "before" },
    { pattern: "の", position: "after" },
  ],
  units: ["%", "％", "パーセント"],
};

const EN: ShareWords = {
  wholes: ["respondents", "users", "customers"],
  links: [
    { pattern: "of", position: "after" },
    { pattern: "of all the", position: "after" },
  ],
  units: ["%", "percent"],
};

const writtenIn = (text: string, words: ShareWords): string[] => sharesOverHundred(text, words).map((found) => `${found.written}:${found.whole}`);

describe("share-over-hundred: 100% を超える一部の割合", () => {
  it("集まりの一部の割合が 100% を超える", () => {
    assert.deepEqual(findingsOf("調査では、回答者の120%が満足と答えました。\n"), ["「120%」は回答者の一部の割合なので、100% を超えません"]);
    assert.deepEqual(findingsOf("In the survey, 120% of respondents said yes.\n", en), ['"120%" is a share of respondents, so it cannot pass 100%']);
  });

  it("集まりを前にも後ろにも書ける。全角、小数、位取り", () => {
    assert.deepEqual(writtenIn("アンケートでは回答者の120%が賛成、120%の回答者が賛成", JA), ["120%:回答者", "120%:回答者"]);
    assert.deepEqual(writtenIn("150％の利用者、回答者のうち101.5%、社員の 1,200%", JA), ["150％:利用者", "101.5%:回答者", "1,200%:社員"]);
    assert.deepEqual(writtenIn("150 percent of all the users", EN), ["150 percent:users"]);
    assert.deepEqual(writtenIn("社員の１，２００%が受講", JA), ["１，２００%:社員"]);
  });

  it("100% 以下と、集まりの無い百分率、伸びや比べる元は言わない", () => {
    assert.deepEqual(writtenIn("回答者の100%、前年の120%、120%の達成率", JA), []);
    assert.deepEqual(writtenIn("99% of users, 120% of last year, 120% growth, 120% of userspace, 120% of users_2025", EN), []);
    assert.deepEqual(writtenIn("前年の120%の回答者数を集めた", JA), []);
  });

  it("コードの中は読まない", () => {
    assert.deepEqual(findingsOf("例：`回答者の120%` は不正な値です。\n"), []);
  });

  it("空の文字列と語の無い言語", () => {
    assert.deepEqual(sharesOverHundred("", JA), []);
    assert.deepEqual(sharesOverHundred("回答者の120%", { wholes: [], links: [], units: [] }), []);
  });
});
