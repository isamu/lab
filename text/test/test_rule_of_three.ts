import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { firedRules } from "./rule-run.ts";
import { continuesBeyond, firstProseOffset, isFigureBreakdown, MIN_LISTS_FOR_SHARE, threeShare } from "../packages/chaff/src/rule-of-three.ts";
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

  it("reports two lists when both have three items", () => {
    assert.equal(threeShare("", lists(3, 3), [], 70)?.count, 2);
    assert.equal(threeShare("", lists(3, 4), [], 70), undefined);
  });

  it("does not measure a single list, or none of three", () => {
    [lists(), lists(3), lists(2, 4, 5)].forEach((found) => assert.equal(threeShare("", found, [], 70), undefined));
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

// A generated report closes with two lists, three factors and three recommendations: the whole document comes in threes,
// though it has only two lists. Self-written text.
describe("rule-of-three: a report with two lists", () => {
  const report = (recommendations: string): string =>
    [
      "# Quarterly report",
      "## Response time",
      "Response time improved. Several factors contributed:",
      "- **Triage:** tickets are routed by category.\n- **Coverage:** an evening shift was added.\n- **Templates:** common answers are saved.",
      "## Recommendations",
      recommendations,
    ].join("\n\n");

  it("invalid: both lists have three items", () => {
    const three = "1. Plan releases with support.\n2. Show a status banner.\n3. Watch satisfaction.";
    assert.equal(firedRules(en, report(three), "business/report").includes("rule-of-three"), true);
  });

  it("valid: one of the two lists has four items", () => {
    const four = "1. Plan releases with support.\n2. Show a status banner.\n3. Watch satisfaction.\n4. Hire one more agent.";
    assert.equal(firedRules(en, report(four), "business/report").includes("rule-of-three"), false);
  });
});

// A news page opens with a box of three key points under its title and date, set by the site's template; with one more
// list of three in the body, the page has two lists of three without anyone padding them. Self-written text.
describe("rule-of-three: a key-points box before the body", () => {
  const box = "- The agency updated its guidance.\n- Tokens are a target for attackers.\n- The draft drew public comment.";
  const body =
    "The guidance covers sign-in tokens. Among the changes are:\n\n- Less prescriptive key rules.\n- Notes on new standards.\n- More options for revocation.";
  const page = (top: string): string => ["# Agency finalizes token guidance", "September 15, 2026", "## Share", top, body].join("\n\n");

  it("valid: the box above the first sentence is not counted", () => {
    assert.equal(firedRules(en, page(box), "business/press-release").includes("rule-of-three"), false);
  });

  it("invalid: the same list after a sentence of the body is counted", () => {
    assert.equal(firedRules(en, page(`Here is the summary.\n\n${box}`), "business/press-release").includes("rule-of-three"), true);
  });

  it("firstProseOffset skips headings, dates, list items and table rows", () => {
    const source = "# Title\n\nMay 1, 2026\n\n- An item.\n| a | b |\n\nThe body starts here.";
    assert.equal(firstProseOffset(source), source.indexOf("The body"));
    assert.equal(firstProseOffset("# Title\n\n- An item."), "# Title\n\n- An item.".length);
    assert.equal(firstProseOffset("本文です。\r\n- 項目"), 0);
    assert.equal(firstProseOffset(""), 0);
  });
});

// A casual internal proposal has two lists of three: the vendor's services, and where the ten pots go (受付：大きめを2鉢,
// 休憩スペース：3鉢, 通路沿い：5鉢). The second is a breakdown of a figure, its length set by the places, and was counted as a
// list padded to three. Self-written text after that shape.
describe("rule-of-three: a breakdown of figures", () => {
  const breakdown = (items: readonly string[]): boolean => {
    const source = items.join("\n");
    const itemSpans = items.map((item) => ({ start: source.indexOf(item), end: source.indexOf(item) + item.length }));
    return isFigureBreakdown(source, { span: { start: 0, end: source.length }, items: items.map((item) => item.length), itemSpans });
  };

  it("every item a label and a figure after it is a breakdown", () => {
    [
      ["- 受付：大きめを2鉢", "- 休憩スペース：3鉢", "- 通路沿い：5鉢"],
      ["1. 本体：３万円", "2. 送料：1,000円"],
      ["* Rent: $1,200", "* Power: $90"],
    ].forEach((items) => assert.equal(breakdown(items), true, items.join(" / ")));
  });

  it("a schedule with the figure in its label, an item without a figure, a long lead-in or no items is not", () => {
    [
      ["- 2026年12月：経営会議にて承認", "- 2027年4月：支給開始"],
      ["- 受付：大きめを2鉢", "- 休憩スペース：好きなもの"],
      ["- 置く場所は次のとおりで、受付には大きめのものを置きます：2鉢"],
      ["- 月1回、業者さんが来て水やりと状態チェック"],
      ["- **件数**：月平均 420 件", "- **確認**：1 件 6 分"],
      ["- 件数の多さ：紙の申請書が月平均 420 件届く", "- 差し戻し：申請の 18% が差し戻しになる"],
      [],
    ].forEach((items) => assert.equal(breakdown(items), false, items.join(" / ")));
  });

  const proposal = (placement: string): string =>
    [
      "# 植物の提案",
      "レンタルがいいと思っています。",
      "- 月1回、業者さんが来て水やりと状態チェック\n- 元気がなくなったら無料で交換\n- 置く場所に合わせて種類を選んでくれる",
      "## 置く場所の案",
      placement,
    ].join("\n\n");

  it("valid: a list of services and a breakdown of pots by place", () => {
    assert.equal(firedRules(ja, proposal("- 受付：大きめを2鉢\n- 休憩スペース：3鉢\n- 通路沿い：5鉢"), "business/proposal").includes("rule-of-three"), false);
  });

  it("invalid: the same places without a figure", () => {
    assert.equal(
      firedRules(ja, proposal("- 受付：大きめのもの\n- 休憩スペース：小さめのもの\n- 通路沿い：細長いもの"), "business/proposal").includes("rule-of-three"),
      true,
    );
  });
});

// A team blog's tips: each list holds three tips, and each tip is a bold piece of advice the item then explains in a few
// sentences. The count is the content; padding to three shows as a thin item of one or two sentences. Self-written text.
describe("rule-of-three: tips written as paragraphs", () => {
  const tip = (lead: string, extra: string): string => `- **${lead}.** ${extra} It takes a week to get used to it. After that, nobody asks.`;
  const tips = (extra: string): string =>
    [
      "# Working with a new team",
      "Here is what helped us in the first month.",
      [tip("Ask which meetings matter", extra), tip("Use the team's tracker", extra), tip("Keep talking", extra)].join("\n"),
      "And here is what helped once the work was under way.",
      [tip("Start with the big tasks", extra), tip("Share drafts early", extra), tip("Leave some things unfinished", extra)].join("\n"),
    ].join("\n\n");

  it("valid: every tip is a short paragraph", () => {
    assert.equal(firedRules(en, tips("Talk to your lead first."), "blog/tech").includes("rule-of-three"), false);
  });

  it("invalid: the same lists with one-line items", () => {
    const thin = tips("").replaceAll(" It takes a week to get used to it. After that, nobody asks.", "");
    assert.equal(firedRules(en, thin, "blog/tech").includes("rule-of-three"), true);
  });
});
