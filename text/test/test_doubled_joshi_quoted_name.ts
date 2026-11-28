import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { quotedNameSpans, quotedNames } from "../packages/chaff/src/detectors/particle-run-quoted-names.ts";
import { namedRuleRun } from "./rule-run.ts";

// no-doubled-joshi: 文書が一度鉤括弧で引いた名前（「地域のための共通の指針」）は、括弧なしで書き直しても同じ名前なので、中の「の」を数えない。例文は自作。

const chains = (body: string): readonly string[] => namedRuleRun("no-doubled-joshi", `# 報告\n\n${body}\n`, ja, "a.md", "business/report").findings;

describe("quotedNames / quotedNameSpans", () => {
  it("助詞を中に持つ引いた名前を一度ずつ。助詞で終わる引用、助詞の無い引用、助詞だけの引用は名前にしない", () => {
    assert.deepEqual(quotedNames("「地域の指針」と『地域の指針』、「実際の」「指針」「の」", ["の"]), ["地域の指針"]);
    assert.deepEqual(quotedNames("「地域の指針」", [""]), []);
    assert.deepEqual(quotedNames("", ["の"]), []);
  });

  it("文の中の名前の位置を、文書の座標で、出るたびに", () => {
    assert.deepEqual(quotedNameSpans("A地域の指針B地域の指針", 10, ["地域の指針"]), [
      { start: 11, end: 16 },
      { start: 17, end: 22 },
    ]);
    assert.deepEqual(quotedNameSpans("ほかの文", 0, ["地域の指針"]), []);
    assert.deepEqual(quotedNameSpans("ほかの文", 0, []), []);
  });
});

describe("no-doubled-joshi: 引いた名前を括弧なしで書き直したもの", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("前に引いた名前の中の「の」を、括弧なしでも数えない", () => {
    assert.deepEqual(chains("会議は「地域のための共通の指針」を定めた。\n\n次の年に、地域のための共通の指針の改定に取り組んだ。"), []);
  });

  it("引いていない連なりと、助詞で終わる引用の後ろの連なりは今までどおり言う", () => {
    assert.equal(chains("次の年に、地域のための共通の指針の改定に取り組んだ。").length, 1);
    assert.equal(chains("「実際の」と書いた。\n\nこれらの実際の動作の概要を見る。").length, 1);
  });
});
