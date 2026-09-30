import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { calendarUnitsOf } from "../packages/chaff/src/calendar-number.ts";
import { closingAndEarlier, newNumbers, type Passage } from "../packages/chaff/src/closing-numbers.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

// 結びの数が、前に書いた数を繰り返しているだけなら、その数は結びの具体物ではない。
// 前に書いていない数（新しい目標、期限、次の数字）は具体物で、結びを問い合わせない理由になる。

/** 最後の節を結び、それより前を本文として、結びの新しい数を返す。 */
const freshIn = (source: string, adapter: LanguageAdapter = ja): string[] => {
  const doc = buildDocument("a.md", source, adapter);
  const last = doc.sections.at(-1);
  if (last === undefined) return [];
  const { closing, earlier } = closingAndEarlier(doc, last);
  return newNumbers(closing, earlier, calendarUnitsOf(doc));
};

const plain = (text: string, base = 0): Passage => ({ text, base, sentences: [] });
const NO_UNITS = { chained: [], positional: new Set<string>(), year: new Set<string>() };

describe("newNumbers: 結びの数が前に書いたものか（日本語）", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("#290 の報告書のまとめ。9月は題と本文にあり、ほかに数は無い", () => {
    const source = [
      "# 9月の問い合わせ対応についての報告",
      "",
      "## 9月の状況",
      "",
      "9月の問い合わせは 412 件で、8月の 356 件から増えました。",
      "",
      "一次回答までの時間は平均 6.2 時間で、目標の 4 時間を超えました。",
      "",
      "## まとめ",
      "",
      "以上のように、9月は問い合わせが増え、一次回答までの時間も目標を超えました。今後も引き続き改善に努めてまいります。",
      "",
    ].join("\n");
    assert.deepEqual(freshIn(source), []);
  });

  it("本文の数を繰り返すだけなら新しくない", () => {
    assert.deepEqual(freshIn("# 報告\n\n問い合わせは 412 件でした。\n\n## まとめ\n\n問い合わせは 412 件でした。\n"), []);
  });

  it("結びにだけある数は新しい", () => {
    assert.deepEqual(freshIn("# 報告\n\n問い合わせは 412 件でした。\n\n## まとめ\n\n来月は 300 件以下を目指します。\n"), ["300"]);
  });

  it("結びの中で二度書いても、前に無ければ新しい", () => {
    assert.deepEqual(freshIn("# 報告\n\n問い合わせが増えました。\n\n## まとめ\n\n412 件のうち 412 件に答えました。\n"), ["412"]);
  });

  it("題にだけある月（文書の主題）は新しくない", () => {
    assert.deepEqual(freshIn("# 2026年9月の月次報告\n\n今月の問い合わせは 412 件でした。\n\n## まとめ\n\n9月は問い合わせが増えました。\n"), []);
  });

  it("題にある月があっても、同じ数の数量は新しい", () => {
    assert.deepEqual(freshIn("# 9月の報告\n\n問い合わせは増えました。\n\n## まとめ\n\n未回答は 9 件です。\n"), ["9"]);
  });

  it("結びの見出しにある月も、前に書いたもの", () => {
    assert.deepEqual(freshIn("# 報告\n\n問い合わせは増えました。\n\n## 9月のまとめ\n\n9月は問い合わせが増えました。\n"), []);
  });

  it("品詞の無い見出しでは、数の後ろの字で日付を見分ける", () => {
    const units = { chained: ["年", "月", "日"], positional: new Set(["月"]), year: new Set(["年"]) };
    assert.deepEqual(newNumbers(plain("9 と 2026 と 30"), plain("# 2026年9月 30日\n\n"), units), ["9", "2026", "30"]);
    assert.deepEqual(newNumbers(plain("9月 2026年 30日"), plain("# 2026年9月 30日\n\n"), units), []);
  });

  it("字で見分けるときも、単位の前の空白 1 つを越え、いちばん長い単位を取る", () => {
    const units = { chained: ["年", "月"], positional: new Set(["月"]), year: new Set(["年", "年度"]) };
    assert.deepEqual(newNumbers(plain("9月"), plain("# 2026 年 9 月の報告\n\n"), units), []);
    assert.deepEqual(newNumbers(plain("2026年"), plain("# 2026年度の報告\n\n"), units), ["2026年"]);
  });

  it("文の中は品詞で見分ける。「3時間」は時刻ではない", () => {
    assert.deepEqual(freshIn("# 報告\n\n対応に 3時間かかりました。\n\n## まとめ\n\n明日は 3時に集まります。\n"), ["3時"]);
  });

  it("本文にない日付は新しい（期限や次の一歩）", () => {
    assert.deepEqual(freshIn("# 報告\n\n9月の問い合わせは 412 件でした。\n\n## まとめ\n\n10月1日から窓口を増やします。\n"), ["10月", "1日"]);
  });

  it("本文の数量と同じ数でも、結びの日付は新しい", () => {
    assert.deepEqual(freshIn("# 報告\n\n未回答は 9 件でした。\n\n## まとめ\n\n9月末までに回答します。\n"), ["9月"]);
  });

  it("本文の日付と同じ数でも、結びの数量は新しい", () => {
    assert.deepEqual(freshIn("# 報告\n\n9月は問い合わせが増えました。\n\n## まとめ\n\n未回答は 9 件です。\n"), ["9"]);
  });

  it("本文の表に書いた数は、前に書いた数", () => {
    assert.deepEqual(freshIn("# 報告\n\n件数は次のとおりです。\n\n| 月 | 件数 |\n| --- | --- |\n| 9 | 412 |\n\n## まとめ\n\n合わせて 412 件でした。\n"), []);
  });

  it("前に何も無い文書では、数はすべて新しい", () => {
    assert.deepEqual(freshIn("問い合わせは 412 件でした。\n"), ["412"]);
  });
});

describe("newNumbers: 結びの数が前に書いたものか（英語）", () => {
  before(async () => {
    await en.prepare?.({ pos: true });
  });

  const body = [
    "# September support report",
    "",
    "## September",
    "",
    "Tickets rose from 356 in August to 412 in September. The first reply took 6.2 hours on average, against a target of 4 hours.",
    "",
  ];

  it("a summary that repeats the body's numbers has nothing new", () => {
    const source = [...body, "## Summary", "", "In short, tickets rose to 412 and the first reply took longer than 4 hours. We will keep improving.", ""].join(
      "\n",
    );
    assert.deepEqual(freshIn(source, en), []);
  });

  it("a number that only the closing states is new", () => {
    const source = [...body, "## Summary", "", "We will add 2 people to the team by October 31.", ""].join("\n");
    assert.deepEqual(freshIn(source, en), ["2", "31"]);
  });

  it("a full stop after a number is not part of it", () => {
    assert.deepEqual(newNumbers(plain("We handled 412."), plain("# Report\n\nTickets rose to 412.\n\n"), NO_UNITS), []);
  });

  it("a sign is part of the number", () => {
    assert.deepEqual(newNumbers(plain("Next month we aim for 1%."), plain("The margin was -1%.\n\n"), NO_UNITS), ["1"]);
  });

  it("a year in the title is the document's subject", () => {
    assert.deepEqual(newNumbers(plain("2026 was a busy year."), plain("# Support in 2026\n\nTickets rose.\n\n"), NO_UNITS), []);
  });

  it("without a word list or tags, numbers are compared by value alone", () => {
    assert.deepEqual(newNumbers(plain("Q3 ended with 412 tickets and 7 open."), plain("In Q3 we had 412 tickets."), NO_UNITS), ["7"]);
  });
});
