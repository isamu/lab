import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { EMPTY } from "../packages/chaff/src/config/load.ts";
import { registerCountsOf } from "../scripts/corpus-findings.ts";
import { contextOf, samplesOf } from "../scripts/bench-samples.ts";
import { politeInPlain } from "../scripts/bench-mutations.ts";
import type { PlantContext } from "../scripts/bench-text.ts";

// yarn bench の polite-in-plain は、chaff 自身が読む文末の調子で植える先を選ぶ。

await ja.prepare?.({ pos: true });

const sampleNamed = (name: string) => {
  const sample = samplesOf("ja").find((candidate) => candidate.name === name);
  assert.ok(sample, name);
  return sample;
};

const PATH = "bench/ja/policy.md";
const countsOf = (source: string, line: number) => registerCountsOf(PATH, source, "ja", "business", EMPTY, line);
const measured: PlantContext = { limits: {}, registers: countsOf };

describe("registerCountsOf", () => {
  it("chaff の読む調子を数える。「こと」で終わる文、名詞で終わる文はどちらにも数えない", () => {
    const source = "会社は機器を貸与する。従業員は機器を管理する。点検は月に一度行うこと。来週に訪問します。以下のとおり。";
    assert.deepEqual(countsOf(source, 1), { polite: 1, plain: 2 });
  });

  it("その行の文と比べ合う文だけを数える。箇条書きは箇条書きの中、本文は本文の中。調子を持つ文の無い行は何も数えない", () => {
    const source = ["# 規程", "", "- 機器を貸与する。", "- 機器を管理する。", "", "ご確認ください。よろしくお願いします。"].join("\n");
    assert.deepEqual(countsOf(source, 3), { polite: 0, plain: 2 });
    assert.deepEqual(countsOf(source, 6), { polite: 2, plain: 0 });
    assert.deepEqual(countsOf(source, 1), { polite: 0, plain: 0 });
  });
});

describe("politeInPlain, measured by chaff", () => {
  it("文書全体では です・ます調が多くても、混ぜた箇条書きの中で である調が多ければ植える", () => {
    const source = ["# 規程", "", "ご確認ください。よろしくお願いします。", "", "- 機器を貸与する。", "- 機器を管理する。", "- 機器を返却する。"].join("\n");
    assert.equal(politeInPlain(source, measured)?.line, 5);
  });

  it("である調の文が本文にしか残らず、混ぜた箇条書きの中に無ければ植えない", () => {
    const source = ["# 規程", "", "- 機器を貸与する。", "", "会社は機器を管理する。"].join("\n");
    assert.equal(politeInPlain(source, measured), undefined);
  });
});

describe("polite-in-plain on the bench samples", () => {
  it("文がみな「こと」で終わる要件一覧には植えない。混ぜた文と食い違う である調の文が無い", () => {
    const sample = sampleNamed("ja/requirements");
    assert.equal(politeInPlain(sample.source, contextOf(sample)), undefined);
  });

  it("である調の文が残る見本には植える", () => {
    const planted = samplesOf("ja").filter((sample) => politeInPlain(sample.source, contextOf(sample)) !== undefined);
    assert.ok(planted.some((sample) => sample.name === "ja/design"));
    assert.ok(planted.length > 1, planted.map((sample) => sample.name).join(", "));
  });
});
