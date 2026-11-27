import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { timeWordParticles } from "../packages/chaff/src/time-word-particles.ts";
import type { Token } from "../packages/chaff/src/plugin.ts";
import { namedRuleRun } from "./rule-run.ts";

// no-doubled-joshi: いつかだけを言う語の「の」（アクターの現在の状態）は、連なりの最後の名詞と一つの名前に読む。例文は自作。

const chains = (body: string): readonly string[] => namedRuleRun("no-doubled-joshi", `# 報告\n\n${body}\n`, ja, "a.md", "business/report").findings;

const tokensOf = (...pieces: readonly (readonly [string, string?])[]): Token[] =>
  pieces.reduce<Token[]>((tokens, [surface, pos]) => {
    const start = tokens.at(-1)?.span.end ?? 0;
    return [...tokens, { surface, pos: pos ?? (surface === "の" ? "ADP" : "NOUN"), span: { start, end: start + surface.length } }];
  }, []);

describe("timeWordParticles", () => {
  const words = ["現在"];
  it("いつかを言う語の後ろの「の」で、次の名詞（複合語も）で連なりが終わるもの", () => {
    const state = tokensOf(["アクター"], ["の"], ["現在"], ["の"], ["状態"], ["を", "ADP"]);
    assert.deepEqual([...timeWordParticles(state, ["の"], words)], [state[3]]);
    const members = tokensOf(["組合"], ["の"], ["現在"], ["の"], ["組合"], ["員"], ["数"], ["は", "ADP"]);
    assert.deepEqual([...timeWordParticles(members, ["の"], words)], [members[3]]);
    const last = tokensOf(["現在"], ["の"], ["状態"]);
    assert.deepEqual([...timeWordParticles(last, ["の"], words)], [last[1]]);
  });

  it("次の名詞の後ろに「の」が続くもの、名詞の続かないもの、ほかの語、間の空いた語、空の文は数えたまま", () => {
    assert.equal(timeWordParticles(tokensOf(["現在"], ["の"], ["方針"], ["の"], ["要点"]), ["の"], words).size, 0);
    assert.equal(timeWordParticles(tokensOf(["現在"], ["の"], ["。", "PUNCT"]), ["の"], words).size, 0);
    assert.equal(timeWordParticles(tokensOf(["現在"], ["の"]), ["の"], words).size, 0);
    assert.equal(timeWordParticles(tokensOf(["任意"], ["の"], ["状態"]), ["の"], words).size, 0);
    const gap: Token[] = [
      { surface: "現在", pos: "NOUN", span: { start: 0, end: 2 } },
      { surface: "の", pos: "ADP", span: { start: 3, end: 4 } },
      { surface: "状態", pos: "NOUN", span: { start: 4, end: 6 } },
    ];
    assert.equal(timeWordParticles(gap, ["の"], words).size, 0);
    assert.equal(timeWordParticles([], ["の"], words).size, 0);
  });
});

describe("no-doubled-joshi: いつかだけを言う語", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("連なりの最後の名詞に係る「現在の」「将来の」を数えない", () => {
    assert.deepEqual(chains("任意のアクターの現在の状態を返します。"), []);
    assert.deepEqual(chains("地域の大気の将来の状態を計算します。"), []);
  });

  it("連なりの途中に立つ「今後の」「現在の」は数える", () => {
    assert.equal(chains("今後の種の保存法の在り方の検討を開始しました。").length, 1);
    assert.equal(chains("当社の現在の方針の要点を示します。").length, 1);
  });

  it("いつかを言う語でない語の「の」は数える", () => {
    assert.equal(chains("世界各地の画像の任意の箇所を切り出します。").length, 1);
  });
});
