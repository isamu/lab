import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import {
  meterUsageMismatches,
  multiplierOf,
  readingOf,
  statesRollover,
  type MeterEntry,
  type MeterWords,
} from "../packages/chaff/src/structure/meter-usage.ts";
import { meterGroups, type MeterReadWords } from "../packages/chaff/src/structure/meter-usage-read.ts";

// 指示数の差が使用量と合わない（meter-usage-mismatch）。例文はすべて自作。

const RULE = "meter-usage-mismatch";

const findingsOf = (source: string, adapter = ja): readonly string[] => namedRuleRun(RULE, source, adapter).findings;

const jaTable = (current: string, previous: string, usage: string): string =>
  ["## 検針結果", "", "| 区分 | 指示数 |", "| --- | --- |", `| 今回指示数 | ${current} |`, `| 前回指示数 | ${previous} |`, "", `ご使用量：${usage}`, ""].join(
    "\n",
  );

const enLines = (current: string, previous: string, usage: string, extra: readonly string[] = []): string =>
  ["## Meter reading", "", `Current reading: ${current}`, "", `Previous reading: ${previous}`, "", `Electricity used: ${usage}`, "", ...extra, ""].join("\n");

const WORDS: MeterWords = {
  units: [
    { pattern: "kWh", unit: "kwh" },
    { pattern: "m3", unit: "m3" },
    { pattern: "ccf", unit: "ccf" },
  ],
  rollover: ["rolled over", "一巡"],
  rolloverNegationAfter: ["ません", "なし"],
  rolloverNegationBefore: ["not", "hasn't"],
  replaced: ["meter replaced"],
};

const entry = (kind: MeterEntry["kind"], value: string, headerUnit?: string): MeterEntry => ({
  kind,
  value,
  offset: 0,
  ...(headerUnit === undefined ? {} : { headerUnit }),
});

const decide = (entries: readonly MeterEntry[], text = ""): readonly string[] =>
  meterUsageMismatches([{ entries, text }], WORDS).map((issue) => String(issue.values["expected"]));

describe("meter-usage-mismatch: 指示数の差が使用量と合わない", () => {
  it("差と違う使用量を指す（ja の表と使用量の行、en の Label: value の行）", () => {
    assert.deepEqual(findingsOf(jaTable("12,660", "12,290", "350kWh")), ["指示数の差（12,660 − 12,290 = 370）が、使用量「350kWh」と合いません"]);
    assert.deepEqual(findingsOf(enLines("48,650 kWh", "47,900 kWh", "720 kWh"), en), [
      "The readings' difference (48,650 kWh − 47,900 kWh = 750) is not the usage 720 kWh",
    ]);
  });

  it("差が使用量と合えば言わない", () => {
    assert.deepEqual(findingsOf(jaTable("12,640", "12,290", "350kWh")), []);
    assert.deepEqual(findingsOf(jaTable("1,284", "1,248", "36m³（2か月分）")), []);
    assert.deepEqual(findingsOf(enLines("48,620 kWh", "47,900 kWh", "720 kWh"), en), []);
  });

  it("列の見出しが名前の表を読む。本体が二行なら行ごとに比べる", () => {
    const columns = "| 今回指示数 | 前回指示数 | ご使用量 |\n| --- | --- | --- |\n| 5,210 | 5,000 | 200 |\n";
    assert.deepEqual(findingsOf(columns), ["指示数の差（5,210 − 5,000 = 210）が、使用量「200」と合いません"]);
    const twoMeters =
      "| 区分 | Current reading | Previous reading | Usage |\n| --- | --- | --- | --- |\n| Day | 300 | 100 | 200 |\n| Night | 900 | 500 | 300 |\n";
    assert.deepEqual(findingsOf(twoMeters, en), ["The readings' difference (900 − 500 = 400) is not the usage 300"]);
    const oneReplaced =
      "| Meter | Current reading | Previous reading | Usage | Note |\n| --- | --- | --- | --- | --- |\n| Day | 300 | 100 | 150 | |\n| Night | 50 | 900 | 0 | meter replaced |\n";
    assert.deepEqual(findingsOf(oneReplaced, en), ["The readings' difference (300 − 100 = 200) is not the usage 150"]);
  });

  it("見出しの単位を指示数の単位として読み、使用量の単位と食い違えば比べない", () => {
    const enTable = "| Reading | kWh |\n| --- | --- |\n| Current reading | 2,348 |\n| Previous reading | 2,328 |\n\nWater used: 18 ccf\n";
    assert.deepEqual(findingsOf(enTable, en), []);
    const sameUnit = "| Reading | ccf |\n| --- | --- |\n| Current reading | 2,348 |\n| Previous reading | 2,328 |\n\nWater used: 18 ccf\n";
    assert.deepEqual(findingsOf(sameUnit, en), ["The readings' difference (2,348 − 2,328 = 20) is not the usage 18 ccf"]);
  });

  it("乗率があれば掛け、読めない乗率なら比べない", () => {
    const multiplied = (multiplier: string, usage: string): string =>
      ["今回指示数：1,250", "", "前回指示数：1,200", "", `乗率：${multiplier}`, "", `ご使用量：${usage}`, ""].join("\n");
    assert.deepEqual(findingsOf(multiplied("10", "500kWh")), []);
    assert.deepEqual(findingsOf(multiplied("×10", "50kWh")), ["指示数の差（1,250 − 1,200 × 10 = 500）が、使用量「50kWh」と合いません"]);
    assert.deepEqual(findingsOf(multiplied("別紙のとおり", "50kWh")), []);
  });

  it("今回が前回より小さいのは、一巡したと書いてあるときだけ読む。取り替えたと書いてあれば比べない", () => {
    assert.deepEqual(findingsOf(enLines("0,120", "9,980", "140"), en), []);
    assert.deepEqual(findingsOf(enLines("0120", "9980", "140", ["The meter rolled over during this period."]), en), []);
    assert.deepEqual(findingsOf(enLines("0120", "9980", "150", ["The meter rolled over during this period."]), en), [
      "The readings' difference (0120 − 9980 = 140) is not the usage 150",
    ]);
    assert.deepEqual(findingsOf(enLines("300", "100", "50", ["The meter was replaced on September 3."]), en), []);
    assert.deepEqual(findingsOf(enLines("120", "9980", "150", ["No rollover occurred."]), en), []);
  });

  it("一巡を同じ節で打ち消していれば、一巡したとは読まない。別の事の打ち消しは一巡を消さない", () => {
    const jaRolled = (note: string): string => ["## 検針結果", "", "今回指示数：0120", "", "前回指示数：9980", "", "ご使用量：150", "", note, ""].join("\n");
    const mismatch = "指示数の差（0120 − 9980 = 140）が、使用量「150」と合いません";
    assert.deepEqual(findingsOf(jaRolled("メーターが一巡しました。")), [mismatch]);
    assert.deepEqual(findingsOf(jaRolled("一巡しましたが、交換はしていません。")), [mismatch]);
    ["一巡していません。", "一巡なし", "メーターの一巡はありません。", "桁あふれはありません。", "一巡はしておらず、"].forEach((note) =>
      assert.deepEqual(findingsOf(jaRolled(note)), [], note),
    );
    const rolled = "The readings' difference (0120 − 9980 = 140) is not the usage 150";
    assert.deepEqual(findingsOf(enLines("0120", "9980", "150", ["The meter rolled over, but it was not replaced."]), en), [rolled]);
    assert.deepEqual(findingsOf(enLines("0120", "9980", "150", ["Notice: the meter rolled over."]), en), [rolled]);
    ["The meter has not rolled over.", "The meter hasn’t rolled over.", "The meter never rolled over.", "The meter did not roll over."].forEach((note) =>
      assert.deepEqual(findingsOf(enLines("0120", "9980", "150", [note]), en), [], note),
    );
  });

  it("見出しが違えば別のまとまりとして読み、一つのまとまりに同じ名前が二つあれば比べない", () => {
    const split = "## 今月\n\n今回指示数：300\n\n前回指示数：100\n\n## お知らせ\n\nご使用量：150\n";
    assert.deepEqual(findingsOf(split), []);
    const twice = "今回指示数：300\n\n今回指示数：400\n\n前回指示数：100\n\nご使用量：150\n";
    assert.deepEqual(findingsOf(twice), []);
  });

  it("名前の付かない文と、コードの中は読まない", () => {
    assert.deepEqual(findingsOf("今回の指示数は300、前回の指示数は100で、使用量は150です。\n"), []);
    assert.deepEqual(findingsOf("```\n今回指示数：300\n前回指示数：100\nご使用量：150\n```\n"), []);
  });
});

describe("meter-usage-mismatch: 判定（Pure）", () => {
  it("丸めの一桁以内は合っていると読み、それを越えれば言う", () => {
    assert.deepEqual(decide([entry("current", "100.4"), entry("previous", "50.0"), entry("usage", "50")]), []);
    assert.deepEqual(decide([entry("current", "100.9"), entry("previous", "50.0"), entry("usage", "50")]), []);
    assert.deepEqual(decide([entry("current", "102.0"), entry("previous", "50.0"), entry("usage", "50")]), ["52.0"]);
  });

  it("小数の乗率を掛ける", () => {
    assert.deepEqual(decide([entry("current", "120"), entry("previous", "100"), entry("multiplier", "1.5"), entry("usage", "30")]), []);
    assert.deepEqual(decide([entry("current", "120"), entry("previous", "100"), entry("multiplier", "1.5"), entry("usage", "20")]), ["30.0"]);
  });

  it("どれかが欠けるか、数でない値、知らない単位の値、負の差は比べない", () => {
    assert.deepEqual(decide([entry("current", "300"), entry("usage", "100")]), []);
    assert.deepEqual(decide([entry("current", "—"), entry("previous", "100"), entry("usage", "100")]), []);
    assert.deepEqual(decide([entry("current", "300 kg"), entry("previous", "100"), entry("usage", "100")]), []);
    assert.deepEqual(decide([entry("current", "300 / 400"), entry("previous", "100"), entry("usage", "100")]), []);
    assert.deepEqual(decide([entry("current", "100"), entry("previous", "300"), entry("usage", "100")]), []);
    assert.deepEqual(decide([entry("current", "300", "kwh"), entry("previous", "100"), entry("usage", "100 m3")]), []);
  });

  it("statesRollover: 打ち消しのない一巡の語があるときだけ真", () => {
    assert.equal(statesRollover("一巡しました", WORDS), true);
    assert.equal(statesRollover("一巡しましたが、交換はしていません", WORDS), true);
    assert.equal(statesRollover("一巡していません。その後一巡しました", WORDS), true);
    assert.equal(statesRollover("一巡していません", WORDS), false);
    assert.equal(statesRollover("一巡なし", WORDS), false);
    assert.equal(statesRollover("It has NOT rolled over", WORDS), false);
    assert.equal(statesRollover("It hasn’t rolled over", WORDS), false);
    assert.equal(statesRollover("Nothing changed and it rolled over", WORDS), true);
    assert.equal(statesRollover("It was not read; it rolled over", WORDS), true);
    assert.equal(statesRollover("It was not replaced and rolled over", WORDS), true);
    assert.equal(statesRollover("It has not yet rolled over", WORDS), false);
    assert.equal(statesRollover("rolled over", WORDS), true);
    assert.equal(statesRollover("", WORDS), false);
    assert.equal(statesRollover("一巡", { ...WORDS, rolloverNegationAfter: [""], rolloverNegationBefore: [] }), true);
    assert.equal(statesRollover("一巡", { ...WORDS, rollover: [""] }), false);
  });

  it("readingOf と multiplierOf の読み", () => {
    assert.equal(readingOf(entry("usage", "36m³（2か月分）"), WORDS)?.unit, "m3");
    assert.equal(readingOf(entry("current", "2,348", "ccf"), WORDS)?.unit, "ccf");
    assert.equal(readingOf(entry("current", ""), WORDS), undefined);
    assert.equal(readingOf(entry("current", "-5"), WORDS), undefined);
    assert.deepEqual(multiplierOf("x 40"), { scaled: 40n, decimals: 0 });
    assert.deepEqual(multiplierOf("10倍"), { scaled: 10n, decimals: 0 });
    assert.equal(multiplierOf("—"), undefined);
    assert.equal(multiplierOf(""), undefined);
  });

  it("meterGroups は空の文書と名前の無い文書から何も作らない", () => {
    const words: MeterReadWords = { labels: [{ pattern: "今回指示数", kind: "current" }], units: [] };
    assert.deepEqual(meterGroups("", [], words), []);
    assert.deepEqual(meterGroups("料金：300円\n", [], words), []);
  });
});
