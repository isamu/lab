import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { wordsOf } from "../packages/chaff/src/detectors/structure.ts";
import { katakanaDensity, katakanaWordsIn, mostFrequent } from "../packages/chaff/src/detectors/katakana-density.ts";

// カタカナ語の多さ（katakana-density）。例文はすべて自作。

const RULE = "katakana-density";

const HEAVY =
  "今回のアジェンダは、プロジェクトのスコープとスケジュールのレビューです。エビデンスをベースにコンセンサスを取り、ネクストアクションをアサインします。";
const PLAIN = "今回の議題は、計画の範囲と日程の見直しです。根拠をもとに合意を取り、次にすることの担当を決めます。";

/** Paragraphs of one sentence repeated, long enough to be measured. */
const documentOf = (sentence: string, times: number): string => `# 会議\n\n${Array.from({ length: times }, () => sentence).join("\n\n")}\n`;

const findingsOf = (source: string, level: "strict" | "normal" | "relaxed" = "normal"): readonly string[] =>
  namedRuleRun(RULE, source, ja, "a.md", "business/report", level).findings;

describe("katakana-density: カタカナ語の多さ", () => {
  it("カタカナ語が多い文書を一度だけ言い、多い語を挙げる", () => {
    const found = findingsOf(documentOf(HEAVY, 8));
    assert.equal(found.length, 1);
    assert.match(found[0] ?? "", /^カタカナ語が 1000 字あたり \d+ 語あります（55 語まで）。多いのは「アジェンダ、プロジェクト、スコープ」です$/u);
  });

  it("日本語で書いた文書は言わない", () => {
    assert.deepEqual(findingsOf(documentOf(PLAIN, 10)), []);
  });

  it("短い文書は測らない", () => {
    assert.deepEqual(findingsOf(documentOf(HEAVY, 2)), []);
  });

  it("文の中のコードの語は数えない", () => {
    const inline = "設定は `アジェンダ` と `スコープ` と `スケジュール` と `レビュー` と `エビデンス` で決めます。";
    assert.deepEqual(findingsOf(documentOf(inline, 12)), []);
  });

  it("コードの中の語は数えない", () => {
    const code = "```\nアジェンダ スコープ スケジュール レビュー エビデンス コンセンサス\n```";
    assert.deepEqual(findingsOf(`${documentOf(PLAIN, 10)}\n${Array.from({ length: 10 }, () => code).join("\n\n")}\n`), []);
  });

  it("語は中黒と長音で切り、長音だけの並びは語にしない", () => {
    assert.deepEqual(katakanaWordsIn("ジョン・スミスとサーバー、ーー、ア。", []), ["ジョン", "スミス", "サーバー"]);
  });

  it("半角のカタカナも数え、語の途中の改行はつなぐ", () => {
    assert.deepEqual(katakanaWordsIn("ｱｼﾞｪﾝﾀﾞを決める。", []), ["ｱｼﾞｪﾝﾀﾞ"]);
    assert.deepEqual(katakanaWordsIn("アジェ\nンダを決める。", []), ["アジェンダ"]);
    assert.deepEqual(katakanaWordsIn("アジェンダ\n\nスコープ", []), ["アジェンダ", "スコープ"]);
  });

  it("chaff.yaml の names に並べた名前は数えない", () => {
    assert.deepEqual(katakanaWordsIn("ミナトの新製品とサーバー", ["ミナト"]), ["サーバー"]);
    assert.deepEqual(katakanaWordsIn("ジョン・スミスとサーバー", ["ジョン・スミス"]), ["サーバー"]);
    const doc = {
      ...buildDocument("a.md", documentOf(HEAVY, 8), ja),
      names: ["アジェンダ", "プロジェクト", "スコープ", "スケジュール", "レビュー", "エビデンス", "ベース", "コンセンサス"],
    };
    assert.deepEqual(katakanaDensity(doc, { limit: 55 }), []);
  });

  it("多い語は回数の順、同じ回数なら先に出た順", () => {
    assert.deepEqual(mostFrequent(["ア", "イ", "イ", "ウ", "ウ", "エ"], 2), ["イ", "ウ"]);
    assert.deepEqual(mostFrequent([], 3), []);
  });

  it("limit ちょうどなら言わず、超えたら言う", () => {
    const doc = buildDocument("a.md", documentOf(HEAVY, 8), ja);
    const measured = katakanaDensity(doc, { limit: -1 })[0]?.values;
    assert.equal(measured?.["count"], 80);
    const density = Number(measured?.["density"]);
    assert.equal(density, Math.round((80 / wordsOf(doc)) * 1000));
    assert.ok(density > 0);
    assert.deepEqual(katakanaDensity(doc, { limit: density }), []);
    assert.equal(katakanaDensity(doc, { limit: density - 1 }).length, 1);
  });
});
