import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { firedRules } from "./rule-run.ts";
import { continuesBeyond, MIN_LISTS_FOR_SHARE, threeShare } from "../packages/chaff/src/rule-of-three.ts";
import type { BulletList } from "../packages/chaff/src/plugin.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

// A human article with four lists, three of them of three items (3 of 4 is 75%, past the 70% limit), and a government
// article whose first list of three goes on with 「など、」 were reported as padded to three. With four lists one list moves
// the share by 25 points, so the share cannot tell "most" from "some"; and a list followed by など says there are more
// than the three written. Self-written text.

const listOf = (items: number, start: number): BulletList => ({
  span: { start, end: start + 1 },
  items: Array.from({ length: items }, (_, index) => index),
  itemSpans: [],
});

const lists = (...counts: number[]): BulletList[] => counts.map((items, index) => listOf(items, index * 10));

describe("threeShare", () => {
  it("reports when every list of a few has three items", () => {
    assert.deepEqual(
      [lists(3, 3, 3), lists(3, 3, 3, 3)].map((found) => threeShare("", found, [], 70)?.count),
      [3, 4],
    );
  });

  it("does not report a share of a few lists that is not all of them", () => {
    assert.equal(threeShare("", lists(3, 3, 3, 2), [], 70), undefined);
    assert.equal(threeShare("", lists(3, 3, 3, 2), [], 50), undefined);
  });

  it("from five lists on, the share decides", () => {
    assert.equal(MIN_LISTS_FOR_SHARE, 5);
    assert.equal(threeShare("", lists(3, 3, 3, 3, 2), [], 70)?.share, 80);
    assert.equal(threeShare("", lists(3, 3, 3, 2, 2), [], 70), undefined);
    assert.equal(threeShare("", lists(3, 3, 3, 2, 2), [], 50)?.share, 60);
  });

  it("does not measure fewer than three lists, or none of three", () => {
    [lists(), lists(3), lists(3, 3), lists(2, 4, 5)].forEach((found) => assert.equal(threeShare("", found, [], 70), undefined));
  });
});

describe("continuesBeyond", () => {
  const after = (below: string): boolean => {
    const source = `- a\n- b\n- c\n${below}`;
    return continuesBeyond(source, { span: { start: 0, end: 12 }, items: [0, 1, 2], itemSpans: [] }, ["など", "等", "etc.", "and so on", "and more"]);
  };

  it("a line opening with an open word below the list says it goes on", () => {
    ["\nなど、原因を作らないようにしましょう。", "\n\n  等の対策があります。", "\netc.", "\nAnd so on, for every room.", "\nand more."].forEach((below) =>
      assert.equal(after(below), true, below),
    );
  });

  it("other lines, a blank end and a longer word do not", () => {
    ["\nこれらを守りましょう。", "", "\n\n", "\nand moreover the cost is low.", "\n文の中のなど"].forEach((below) => assert.equal(after(below), false, below));
  });
});

const JA_LIST = "- 果実を取り除く\n- 生ゴミを置かない\n- 草を刈る";
const firesJa = (body: string): boolean => firedRules(ja, `# クマ対策\n\n${body}`, "blog/owned-media").includes("rule-of-three");

describe("rule-of-three: few lists and lists that go on", () => {
  it("valid: three of four lists of three", () => {
    const blocks = ["対策です。", "次の点に注意します。", "準備です。"].map((lead) => `${lead}\n\n${JA_LIST}`);
    assert.equal(firesJa([...blocks, "持ち物です。\n\n- 鈴\n- ラジオ"].join("\n\n")), false);
  });

  it("valid: a list of three that goes on with など is not exactly three", () => {
    const blocks = ["対策です。", "次の点に注意します。", "準備です。"].map((lead) => `${lead}\n\n${JA_LIST}`);
    assert.equal(firesJa([`寄せ付けないために。\n\n${JA_LIST}\n\nなど、原因を作らないようにしましょう。`, ...blocks].join("\n\n")), false);
  });

  it("invalid: every one of four lists has three items", () => {
    const blocks = ["対策です。", "次の点に注意します。", "準備です。", "持ち物です。"].map((lead) => `${lead}\n\n${JA_LIST}`);
    assert.equal(firesJa(blocks.join("\n\n")), true);
  });

  it("invalid: four of five lists of three, in English, one followed by prose", () => {
    const list = "- Count\n- Record\n- Review";
    const blocks = ["Every day we:", "Every week we:", "Every month we:", "Every year we:"].map((lead) => `${lead}\n\n${list}\n\nThat is all.`);
    const source = `# Stock\n\n${[...blocks, "Tools:\n\n- Pen\n- Paper"].join("\n\n")}`;
    assert.equal(firedRules(en, source, "blog/tech").includes("rule-of-three"), true);
    assert.equal(firedRules(en, source.replace("That is all.", "etc."), "blog/tech").includes("rule-of-three"), false);
  });
});
