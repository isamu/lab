import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";

// orthographic-variant: 複合の助詞「をもとに」は、名詞の「元」と別に、自分の書き方どうしで比べる。例文はすべて自作。

const findingsOf = (source: string): readonly string[] => namedRuleRun("orthographic-variant", source, ja).findings;

before(async () => {
  await ja.prepare?.({ pos: true });
});

describe("orthographic-variant: をもとに", () => {
  it("「をもとに」を名詞の「元」と比べない", () => {
    assert.deepEqual(findingsOf("# 手順\n\n集計の元となる表を作る。元の値は残す。記録をもとに予定を決める。\n"), []);
  });

  it("「をもとに」と「を元に」は今までどおり比べる", () => {
    assert.equal(findingsOf("# 手順\n\n記録を元に予定を決める。表を元に計算する。案を元に話す。記録をもとに直す。\n").length, 1);
  });
});
