import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";

// orthographic-variant: 「や」で名詞と並べた「物」（物やサービス）は物を言う語で、形式名詞の「もの」（延長するものです）と比べない。例文はすべて自作。

const findingsOf = (source: string): readonly string[] => namedRuleRun("orthographic-variant", source, ja).findings;

before(async () => {
  await ja.prepare?.({ pos: true });
});

describe("orthographic-variant: 名詞と並べた「物」", () => {
  it("「物やサービス」の物を、形式名詞の「もの」と比べない", () => {
    const source = "# 説明\n\n期限を延長するものです。義務を示したものであり、可決すべきものと決しました。買えない物やサービスを生み出す。\n";
    assert.deepEqual(findingsOf(source), []);
  });

  it("名詞と並べない形式名詞の「物」は今までどおり比べる", () => {
    const source = "# 説明\n\n期限を延長するものです。義務を示したものであり、可決すべきものと決しました。買えない物を生み出す。\n";
    assert.equal(findingsOf(source).length, 1);
  });
});
