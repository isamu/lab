import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";

// 標準的でない語（nonstandard-word）。例文はすべて自作。

const RULE = "nonstandard-word";

const findingsOf = (source: string, adapter = en): readonly string[] => namedRuleRun(RULE, `${source}\n`, adapter).findings;

describe("nonstandard-word: 標準的でない語", () => {
  before(async () => {
    await en.prepare?.({ pos: true });
    await ja.prepare?.({ pos: true });
  });

  it("英語の標準的でない語を言う", () => {
    assert.deepEqual(findingsOf("The team is comprised of five engineers."), ['"is comprised of" is nonstandard in formal writing; write "comprises"']);
    assert.deepEqual(findingsOf("We will ship on Friday, irregardless of the forecast."), [
      '"irregardless" is nonstandard in formal writing; write "regardless"',
    ]);
    assert.deepEqual(findingsOf("Anyways, the build is green."), ['"Anyways" is nonstandard in formal writing; write "Anyway"']);
  });

  it("日本語の標準的でない語を言う", () => {
    assert.deepEqual(findingsOf("昨日の数字は、先週の報告と違かった。", ja), ["「違かっ」は書き言葉では標準的でない形です。「違っ」と書きます"]);
    assert.deepEqual(findingsOf("返信が遅くなり、すいません。", ja), ["「すいません」は書き言葉では標準的でない形です。「すみません」と書きます"]);
  });

  it("標準の形と、語の一部は言わない", () => {
    assert.deepEqual(findingsOf("The team comprises five engineers and is composed of two groups."), []);
    assert.deepEqual(findingsOf("Regardless of the forecast, we ship anyway."), []);
    assert.deepEqual(findingsOf("昨日の数字は、先週の報告と違った。返信が遅くなり、すみません。", ja), []);
    assert.deepEqual(findingsOf("この結果は間違いないと言えます。違いはありません。", ja), []);
  });

  it("more nonstandard forms in both languages, and the standard ones are left alone", () => {
    assert.deepEqual(findingsOf("For all intensive purposes, the work is done."), [
      '"For all intensive" is nonstandard in formal writing; write "For all intents and"',
    ]);
    assert.deepEqual(findingsOf("The court applied the statue of limitations."), ['"statue" is nonstandard in formal writing; write "statute"']);
    assert.deepEqual(findingsOf("For all intents and purposes, the work is done. The statue stands in the park."), []);
    assert.deepEqual(findingsOf("今日の注文はすごい多い。", ja), ["「すごい」は書き言葉では標準的でない形です。「すごく」と書きます"]);
    assert.deepEqual(findingsOf("今日の注文はすごく多い。すごい人が多い。", ja), []);
  });

  it("コードの中は読まない", () => {
    assert.deepEqual(findingsOf("Set `irregardless = true` in the config."), []);
  });
});
