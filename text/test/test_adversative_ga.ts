import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { isContrastiveGa } from "../packages/chaff/src/detectors/adversative-ga.ts";
import type { Token } from "../packages/chaff/src/plugin.ts";

// adversative-ga-repeat が数える「が」: 二つの節を対比させるものだけ。例文は自作か、著作権の切れた作品（菊池寛『屋上の狂人』、岸田國士『牛山ホテル』）から。

const RULE = "adversative-ga-repeat";
const TWO = "一文に逆接の「が」が 2 個あります（1 個まで）";

before(async () => {
  await ja.prepare?.({ pos: true });
});

const findingsOf = (source: string): readonly string[] => namedRuleRun(RULE, `${source}\n`, ja, "a.md", "business/report", "normal").findings;

/** For each conjunctive が of the sentence, whether it contrasts two clauses. */
const contrastsIn = (sentence: string): boolean[] => {
  const tokens: readonly Token[] = buildDocument("a.md", `${sentence}\n`, ja).sentences[0]?.tokens ?? [];
  return tokens.flatMap((token, at) => (token.surface === "が" && token.pos === "SCONJ" ? [isContrastiveGa(at, tokens)] : []));
};

describe("adversative-ga-repeat: a が that contrasts nothing", () => {
  it("a verb's volitional before が (あろうがあるまいが) concedes; it is not counted", () => {
    assert.deepEqual(findingsOf("足場があろうがあるまいが、どなな所へでも上るんやけにな。"), []);
    assert.deepEqual(findingsOf("来ようが来まいが、会は開くが、席は減らす。"), []);
    assert.deepEqual(contrastsIn("食べようが、残そうが自由だ。"), [false, false]);
  });

  it("a が with only punctuation after it softens the end; it is not counted", () => {
    assert.deepEqual(findingsOf("――ですがねえ、奥さん、責めてをられるやうに思へるんですが……。"), []);
    assert.deepEqual(contrastsIn("そう思うんですが。"), [false]);
  });

  it("still counts the contrastive が beside them", () => {
    assert.deepEqual(findingsOf("予算は足りるが、人手は足りないが、納期は守ります。"), [TWO]);
    // でしょうが, だろうが follow an auxiliary: they contrast.
    assert.deepEqual(findingsOf("難しいでしょうが、予算は足りますが、人手は足りません。"), [TWO]);
    assert.deepEqual(findingsOf("高いだろうが、品は良いが、量は少ない。"), [TWO]);
    // A が with a clause after it, before the final punctuation, is not an end.
    assert.deepEqual(findingsOf("予算は足りるが、人手は足りないが、まあ守る……。"), [TWO]);
  });

  it("isContrastiveGa: the edges of the token list", () => {
    const ga: Token = { surface: "が", pos: "SCONJ", span: { start: 0, end: 1 } };
    assert.equal(isContrastiveGa(0, [ga]), false);
    assert.equal(isContrastiveGa(5, []), false);
    assert.deepEqual(contrastsIn("予算は足りるが、人手は足りない。"), [true]);
  });
});
