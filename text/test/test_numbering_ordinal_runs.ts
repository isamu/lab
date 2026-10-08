import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { prepare } from "../packages/lang-ja/src/pos.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { framesAt, ordinalFramesOf, ordinalRunBreaks, ordinalRuns, type RunNumber } from "../packages/chaff/src/structure/ordinal-runs.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// numbering-gap は日程の第N回・Week N の並び（表の最初の欄、箇条書きの頭、行の頭）も比べる。例文はすべて自作。

const lines = (...rows: string[]): string => rows.join("\n");

const gapsOf = (adapter: LanguageAdapter, source: string): [unknown, unknown, unknown][] =>
  runRules(buildDocument("s.md", source, adapter), loadRules(adapter.id), {}, true, "business/report")
    .findings.filter((finding) => finding.rule === "numbering-gap")
    .map((finding) => [finding.line, finding.values["previous"], finding.values["label"]]);

before(async () => prepare());

describe("a schedule's numbered run that skips or repeats is reported", () => {
  it("a Japanese table of 第N回 that jumps from 第5回 to 第7回, then repeats 第7回", () => {
    const source = lines(
      "# 授業計画",
      "",
      "| 回 | 内容 |",
      "| --- | --- |",
      "| 第4回 | 分散 |",
      "| 第5回 | 相関 |",
      "| 第7回 | 回帰 |",
      "| 第7回 | 読み方 |",
      "| 第8回 | 演習 |",
      "",
    );
    assert.deepEqual(gapsOf(ja, source), [
      [7, "第5回", "第7回"],
      [8, "第7回", "第7回"],
    ]);
  });

  it("an English table of Week N that jumps from Week 5 to Week 7", () => {
    const source = lines(
      "# Schedule",
      "",
      "| Week | Topic |",
      "| --- | --- |",
      "| Week 4 | Variance |",
      "| Week 5 | Correlation |",
      "| Week 7 | Regression |",
      "| Week 8 | Review |",
      "",
    );
    assert.deepEqual(gapsOf(en, source), [[7, "Week 5", "Week 7"]]);
  });

  it("a pipeless table, with full-width figures", () => {
    const source = lines("回 | 内容", "--- | ---", "第１回 | 導入", "第２回 | 基礎", "第４回 | 応用", "");
    assert.deepEqual(gapsOf(ja, source), [[5, "第２回", "第４回"]]);
  });

  it("a table whose first cells are bold", () => {
    const source = lines("| Week | Topic |", "| --- | --- |", "| **Week 1** | Intro |", "| **Week 2** | Data |", "| **Week 4** | Models |", "");
    assert.deepEqual(gapsOf(en, source), [[5, "Week 2", "Week 4"]]);
  });

  it("an English list of sessions that repeats Session 2", () => {
    const source = lines("# Workshop", "", "- Session 1: Overview", "- Session 2: Methods", "- Session 2: Results", "- Session 3: Wrap-up", "");
    assert.deepEqual(gapsOf(en, source), [[5, "Session 2", "Session 2"]]);
  });

  it("Japanese lines of 第N週, each its own paragraph", () => {
    const source = lines("# 日程", "", "第1週　導入と準備", "", "第2週：調査の方法", "", "第4週（発表）", "", "第5週 まとめ", "");
    assert.deepEqual(gapsOf(ja, source), [[7, "第2週", "第4週"]]);
  });

  it("a joined number is counted from its last: Weeks 1-2, Week 3, then Week 5", () => {
    const source = lines("# Plan", "", "- Weeks 1-2: Reading", "- Week 3: Proposal", "- Week 5: Draft", "- Week 6: Final", "");
    assert.deepEqual(gapsOf(en, source), [[5, "Week 3", "Week 5"]]);
  });

  it("a numbered list carrying sessions is reported once on the line", () => {
    const source = lines("# Workshop", "", "1. Session 1: Overview", "2. Session 2: Methods", "4. Session 4: Results", "");
    assert.deepEqual(gapsOf(en, source), [[5, "2.", "4."]]);
  });

  it("an English schedule inside a Japanese document", () => {
    const source = lines("# 日程", "", "- Day 1 東京", "- Day 2 京都", "- Day 4 大阪", "");
    assert.deepEqual(gapsOf(ja, source), [[5, "Day 2", "Day 4"]]);
  });
});

describe("a run that is not a sequence by design, or not a run, is left alone", () => {
  it("a consecutive schedule", () => {
    const source = lines("| 回 | 内容 |", "| --- | --- |", "| 第1回 | 導入 |", "| 第2回 | 基礎 |", "| 第3回 | 応用 |", "");
    assert.deepEqual(gapsOf(ja, source), []);
  });

  it("a table of selected weeks under a heading that says so", () => {
    const source = lines("## Selected weeks", "", "| Week | Topic |", "| --- | --- |", "| Week 1 | Intro |", "| Week 2 | Data |", "| Week 5 | Models |", "");
    assert.deepEqual(gapsOf(en, source), []);
  });

  it("a table whose header row says highlights", () => {
    const source = lines("## Schedule", "", "| Highlights | Topic |", "| --- | --- |", "| Week 1 | Intro |", "| Week 2 | Data |", "| Week 5 | Models |", "");
    assert.deepEqual(gapsOf(en, source), []);
  });

  it("a Japanese excerpt of the schedule", () => {
    const source = lines("## 授業計画（抜粋）", "", "| 回 | 内容 |", "| --- | --- |", "| 第1回 | 導入 |", "| 第2回 | 基礎 |", "| 第6回 | 応用 |", "");
    assert.deepEqual(gapsOf(ja, source), []);
  });

  it("a run of two", () => {
    const source = lines("# Plan", "", "- Week 1: Intro", "- Week 3: Review", "");
    assert.deepEqual(gapsOf(en, source), []);
  });

  it("chosen weeks that mostly do not follow on (2, 5, 9, 12)", () => {
    const source = lines("# Plan", "", "- Week 2: Quiz", "- Week 5: Quiz", "- Week 9: Quiz", "- Week 12: Quiz", "");
    assert.deepEqual(gapsOf(en, source), []);
  });

  it("lines that mention a meeting in a sentence (第3回の), not number it", () => {
    const source = lines("# 経緯", "", "第3回の会議で方針を決めた。", "", "第4回の会議で予算を決めた。", "", "第6回の会議で承認した。", "");
    assert.deepEqual(gapsOf(ja, source), []);
  });

  it("a second term counting from 第1回 again", () => {
    const source = lines("| 回 | 内容 |", "| --- | --- |", "| 第1回 | 導入 |", "| 第2回 | 基礎 |", "| 第1回 | 後期の導入 |", "| 第2回 | 後期の基礎 |", "");
    assert.deepEqual(gapsOf(ja, source), []);
  });

  it("a second term that restarts at Week 1 and runs only two rows", () => {
    const source = lines(
      "| Week | Topic |",
      "| --- | --- |",
      "| Week 1 | Spring intro |",
      "| Week 2 | Spring data |",
      "| Week 1 | Fall intro |",
      "| Week 3 | Fall models |",
      "",
    );
    assert.deepEqual(gapsOf(en, source), []);
  });

  it("a row that joins two sessions in a way not read (第2・第3回) ends the run instead of opening a gap", () => {
    const source = lines("| 回 | 内容 |", "| --- | --- |", "| 第1回 | 導入 |", "| 第2・第3回 | 実習 |", "| 第4回 | 発表 |", "| 第5回 | まとめ |", "");
    assert.deepEqual(gapsOf(ja, source), []);
  });

  it("a schedule quoted from another document, and one inside a code block", () => {
    const quoted = lines("> - Week 1: Intro", "> - Week 2: Data", "> - Week 4: Models", "");
    const code = lines("```", "Week 1 Intro", "Week 2 Data", "Week 4 Models", "```", "");
    assert.deepEqual(gapsOf(en, quoted), []);
    assert.deepEqual(gapsOf(en, code), []);
  });

  it("a table of articles stays the table's data (第N条 is not a schedule frame)", () => {
    const source = lines("条 | 内容", "--- | ---", "第1条 | 目的", "第3条 | 定義", "第4条 | 雑則", "");
    assert.deepEqual(gapsOf(ja, source), []);
  });
});

const run = (...numbers: (number | [number, number])[]): RunNumber[] =>
  numbers.map((value, index) => {
    const [ordinal, last] = typeof value === "number" ? [value, value] : value;
    return { group: "week", ordinal, last, label: `Week ${String(ordinal)}`, offset: index };
  });

describe("ordinalRunBreaks", () => {
  it("reports a skip and a repeat", () => {
    assert.deepEqual(
      ordinalRunBreaks(run(1, 2, 4, 5, 5, 6)).map((issue) => issue.values["found"]),
      [4, 5],
    );
  });

  it("reads nothing from an empty run, a short run, or one number throughout", () => {
    assert.deepEqual(ordinalRunBreaks([]), []);
    assert.deepEqual(ordinalRunBreaks(run(1, 3)), []);
    assert.deepEqual(ordinalRunBreaks(run(2, 2, 2)), []);
  });

  it("counts on from the last of a joined number", () => {
    assert.deepEqual(ordinalRunBreaks(run([1, 2], 3, 4)), []);
    assert.deepEqual(
      ordinalRunBreaks(run([1, 2], 4, 5)).map((issue) => issue.values["expected"]),
      [3],
    );
  });

  it("leaves a run where most steps skip", () => {
    assert.deepEqual(ordinalRunBreaks(run(1, 3, 5, 6)), []);
  });
});

describe("framesAt and ordinalRuns", () => {
  const frames = ordinalFramesOf(en.lexicons["ordinal-frame"] ?? []);

  it("reads a frame at the start only, followed by a break", () => {
    assert.equal(framesAt("Week 3: Data", frames).length, 1);
    assert.equal(framesAt("week 3 Data", frames).length, 1);
    assert.deepEqual(framesAt("The Week 3 lab", frames), []);
    assert.deepEqual(framesAt("Week 3rd", frames), [{ group: "week", unreadable: true }]);
    assert.deepEqual(framesAt("", frames), []);
  });

  it("an entry without {n} or a group is no frame", () => {
    assert.deepEqual(ordinalFramesOf([{ pattern: "Week", group: "week" }, { pattern: "Week {n}" }]), []);
  });

  it("an unreadable lead ends its group's run", () => {
    const leads = ["Week 1", "Week 2", "Week 3 and 4", "Week x", "Week 2/3", "Week 5", "Week 6"].map((lead, offset) => ({
      offset,
      read: framesAt(lead, frames),
    }));
    assert.deepEqual(
      ordinalRuns(leads).map((each) => each.map((item) => item.ordinal)),
      [
        [1, 2, 3],
        [5, 6],
      ],
    );
  });
});
