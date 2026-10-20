import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";

// 語の途中の空白（「例 えば」）は、解析器が後ろのかなを語として読めなくても、語句の中の空白として数える。例文はすべて自作。

const findingsOf = (source: string): readonly string[] => namedRuleRun("stray-space", source, ja, "a.md", "academic/paper").findings;

const body = ["# 概要", "", "雑誌の収録は毎年見直されている。", "審査の基準も公開されている。", "選び方は図書館が決めている。", ""].join("\n");

describe("stray-space: 語の途中で切れたかなの前の空白", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("「例 えば」の空白を、語の中の空白として指す", () => {
    assert.equal(findingsOf(`${body}\n例 えば、収録を外された雑誌もある。\n`).length, 1);
  });

  it("詰めて書いた「例えば」と、読点で区切った感動詞の前の空白は指さない", () => {
    assert.deepEqual(findingsOf(`${body}\n例えば、収録を外された雑誌もある。\n`), []);
    assert.deepEqual(findingsOf(`${body}\n返事は一言 ええ、だけだった。\n`), []);
    assert.deepEqual(findingsOf(`${body}\n山田 あのね、と話し始めた。\n`), []);
  });
});
