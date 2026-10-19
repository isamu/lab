import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { fixedEndingSpans } from "../packages/chaff/src/detectors/gram-furniture.ts";

// ngram-repetition: 通知が改正点を並べる決まった結び（〜ものとすること。）を、書き手の言い回しとして数えない。例文はすべて自作。

const findingsOf = (source: string): readonly string[] => namedRuleRun("ngram-repetition", source, ja).findings;

before(async () => {
  await ja.prepare?.({ pos: true });
});

const ITEMS = [
  "国は、文化の振興に関する施策を総合的かつ計画的に推進するため、基本的な計画を定め",
  "地方公共団体は、国との連携を図りつつ、地域の実情に応じた施策を講じ",
  "文部科学大臣は、計画の案を作るときは、あらかじめ関係する行政機関の長と協議を行い",
  "国は、芸術家や技術者の養成と確保のために、研修の機会の充実その他の必要な支援を行い",
  "地方公共団体は、住民が身近に芸術を楽しめるよう、劇場や音楽堂の整備に努め",
  "国は、学校や地域において子どもが芸術に触れる機会の充実を図り",
  "文部科学大臣は、毎年度、関係する機関の意見を聴いた上で、施策の実施の状況を公表し",
  "国は、海外の芸術団体との国際的な交流の推進に必要な体制を整え",
  "国と地方公共団体は、高齢者や障害者の創造的な活動を支えるため、環境の整備を進め",
  "国は、施策の効果を検証し、その結果を次の計画に生かす仕組みを設け",
];

const notice = (ending: (stem: string) => string): string =>
  ["# 改正の概要", "", "このたびの改正の概要は、次のとおりです。各位におかれては、内容を十分に御了知の上、関係の機関への周知をお願いします。", ""]
    .concat(ITEMS.map((stem, index) => `（${index + 1}）${ending(stem)}\n`))
    .join("\n");

describe("ngram-repetition: 書式の決まった結び", () => {
  it("改正点ごとの「〜ものとすること。」を言い回しとして数えない", () => {
    assert.deepEqual(findingsOf(notice((stem) => `${stem}るものとすること。`)), []);
    assert.deepEqual(findingsOf(notice((stem) => `${stem}たものとしたこと。`)), []);
  });

  it("ほかの文の終わりの繰り返し（〜してまいります。）は今までどおり指摘する", () => {
    assert.equal(findingsOf(notice((stem) => `${stem}、取り組んでまいります。`)).length, 1);
  });

  it("結びの範囲（文の終わりにあるときだけ）", () => {
    const endings = ["ものとすること。", "こととしたこと。"];
    assert.deepEqual(fixedEndingSpans("施策を講ずるものとすること。", endings), [{ start: 6, end: 14 }]);
    assert.deepEqual(fixedEndingSpans("施策を講ずるものとすること。\n", endings), [{ start: 6, end: 14 }]);
    assert.deepEqual(fixedEndingSpans("ものとすること。を定める。", endings), []);
    assert.deepEqual(fixedEndingSpans("施策を講ずる。", endings), []);
    assert.deepEqual(fixedEndingSpans("", endings), []);
    assert.deepEqual(fixedEndingSpans("施策を講ずるものとすること。", []), []);
    assert.deepEqual(fixedEndingSpans("施策を講ずる。", [""]), []);
  });
});
