import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";

// さらに一般に means "more generally (speaking)": it widens the argument and compares nothing. The excerpt is from
// 最高裁判所 昭和31年7月4日判決 (a judgment, not protected by copyright: 著作権法13条3号).

const bare = (source: string): readonly string[] => namedRuleRun("comparative-without-baseline", source, ja, "a.md", "legal/judgment").findings;

const LEAD = "法が当事者の欲したところと異る法的効果を意思表示に附した場合も、良心の自由に反し憲法違反だと結論しなければならなくなる。";

describe("comparative-without-baseline: さらに一般に is not a comparison", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("さらに一般に is not reported", () => {
    assert.deepEqual(bare(`${LEAD}さらに一般に法秩序を否定する者に対し法を強制すること自体がその者の良心の自由を侵害するといわざるを得なくなる。\n`), []);
  });

  it("さらに with a gradable word in the same place is still reported", () => {
    assert.equal(bare(`${LEAD}さらに容易に法秩序を否定する者に対し法を強制すること自体がその者の良心の自由を侵害するといわざるを得なくなる。\n`).length, 1);
  });
});
