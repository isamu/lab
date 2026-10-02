import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

// 重言（redundant-expression）。例文はすべて自作。

const redundant = (source: string, adapter = ja): readonly string[] => namedRuleRun("redundant-expression", `${source}\n`, adapter).findings;

describe("redundant-expression: 重言", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
    await en.prepare?.({ pos: true });
  });

  it("同じ意味の語の重なりを指す。動詞は活用した形にも当たる", () => {
    assert.deepEqual(redundant("一番最初に、手順を確認してください。"), ["「一番最初」は同じ意味の語を重ねています"]);
    assert.deepEqual(redundant("後で後悔しないように書きます。"), ["「後で後悔」は同じ意味の語を重ねています"]);
    assert.deepEqual(redundant("賛成が過半数を超えた。"), ["「過半数を超える」は同じ意味の語を重ねています"]);
    assert.deepEqual(redundant("返事を返しました。"), ["「返事を返す」は同じ意味の語を重ねています"]);
  });

  it("重ねていない形と、辞書が一語として載せる慣用は指さない", () => {
    assert.deepEqual(redundant("最初に、手順を確認してください。"), []);
    assert.deepEqual(redundant("排気ガスの量を測ります。"), []);
    assert.deepEqual(redundant("頭が痛いので休みます。"), []);
  });

  it("English pairs, with past forms of the verb pairs", () => {
    assert.deepEqual(redundant("The end result is a shorter build.", en), ['"end result" says the same thing twice']);
    assert.deepEqual(redundant("We reverted back to the old schema.", en), ['"reverted back" says the same thing twice']);
    assert.deepEqual(redundant("Each and every user gets a key.", en), ['"each and every" says the same thing twice']);
  });

  it("English idioms that are sometimes needed are left alone", () => {
    assert.deepEqual(redundant("Tell us whether or not you can attend.", en), []);
    assert.deepEqual(redundant("The result is a shorter build.", en), []);
    assert.deepEqual(redundant("Past experience helps.", en), []);
  });
});
