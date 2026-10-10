import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";
import { messageOf } from "../packages/chaff/src/render/text.ts";
import { longestInOrder, outOfPlace, siblingHeadingRuns, type HeadingSpan } from "../packages/chaff/src/structure/date-order.ts";
import { breakDateTie } from "../packages/chaff/src/structure/date-order-tie.ts";

// 日程として並べた日付の順番（date-order）。言語を問わず、箇条書きと表の行を並びとして読む。

const found = (source: string, adapter: LanguageAdapter = en, language = "en"): string[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(language), { "date-order": "normal" }, false, "business/report")
    .findings.filter((finding) => finding.rule === "date-order")
    .map((finding) =>
      finding.values["next"] === undefined
        ? `${String(finding.values["date"])}<${String(finding.values["previous"])}`
        : `${String(finding.values["date"])}>${String(finding.values["next"])}`,
    );

const list = (...dates: string[]): string => ["# Plan", "", ...dates.map((date) => `- ${date} step`)].join("\n");

describe("date-order", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("an oldest-first list with one date going back", () => {
    assert.deepEqual(found(list("2026-04-01", "2026-05-01", "2026-04-15", "2026-07-01")), ["April 15, 2026<May 1, 2026"]);
  });

  it("a newest-first list is a right order; one date going forward in it is not", () => {
    assert.deepEqual(found(list("2026-09-01", "2026-08-01", "2026-07-01")), []);
    assert.deepEqual(found(list("2026-09-01", "2026-08-01", "2026-08-15", "2026-07-01")), ["August 15, 2026<August 1, 2026"]);
  });

  it("without a clear direction (as many steps each way) nothing is said", () => {
    assert.deepEqual(found(list("2026-04-01", "2026-05-01", "2026-04-15")), []);
    assert.deepEqual(found(list("2026-01-01", "2026-02-01", "2026-03-01", "2026-02-15", "2026-01-15")), []);
  });

  it("equal dates do not break the order", () => {
    assert.deepEqual(found(list("2026-04-01", "2026-04-01", "2026-05-01", "2026-06-01")), []);
  });

  it("a line with two dates (a period) is left out of the sequence", () => {
    assert.deepEqual(found(list("2026-04-01", "2026-03-01 to 2026-05-01", "2026-06-01", "2026-07-01")), []);
  });

  it("dates written to different precision are not compared", () => {
    assert.deepEqual(found(list("2026-04-01", "May 2026", "2026-03-01", "2026-07-01")), []);
  });

  it("dates in running text are not a schedule", () => {
    assert.deepEqual(found("# Notes\n\nWe met on 2026-05-01. The plan dates from 2026-04-01. It ends on 2026-03-01."), []);
  });

  it("two lists separated by a paragraph are not joined", () => {
    const source = ["# Plan", "", "- 2026-04-01 a", "- 2026-05-01 b", "- 2026-06-01 c", "", "Later:", "", "- 2026-01-01 d", "- 2026-02-01 e"].join("\n");
    assert.deepEqual(found(source), []);
  });

  it("numbered lists and table rows are sequences too", () => {
    assert.deepEqual(found(["# Plan", "", "1. 2026-04-01 a", "2. 2026-05-01 b", "3. 2026-04-15 c", "4. 2026-07-01 d"].join("\n")), [
      "April 15, 2026<May 1, 2026",
    ]);
    const table = [
      "# Plan",
      "",
      "| Step | Date |",
      "| --- | --- |",
      "| a | 2026-04-01 |",
      "| b | 2026-05-01 |",
      "| c | 2026-04-15 |",
      "| d | 2026-07-01 |",
    ].join("\n");
    assert.deepEqual(found(table), ["April 15, 2026<May 1, 2026"]);
  });

  it("a nested list: children do not break the parents' order, and each group of children is its own sequence", () => {
    const source = [
      "# History",
      "",
      "- 2026-01-01 topic A",
      "  - 2026-06-01 detail",
      "- 2026-02-01 topic B",
      "  - 2026-05-01 detail",
      "- 2026-03-01 topic C",
      "- 2026-04-01 topic D",
    ].join("\n");
    assert.deepEqual(found(source), []);
  });

  it("children of different parents are separate sequences", () => {
    const source = [
      "# Plan",
      "",
      "- Phase 1",
      "  - 2026-06-01 a",
      "  - 2026-07-01 b",
      "  - 2026-08-01 c",
      "- Phase 2",
      "  - 2026-01-01 d",
      "  - 2026-02-01 e",
      "  - 2026-03-01 f",
    ].join("\n");
    assert.deepEqual(found(source), []);
  });

  it("a list followed straight by a table is two sequences", () => {
    const source = [
      "# Plan",
      "",
      "- 2026-01-01 a",
      "- 2026-02-01 b",
      "- 2026-03-01 c",
      "| Step | Date |",
      "| --- | --- |",
      "| d | 2025-01-01 |",
      "| e | 2025-02-01 |",
      "| f | 2025-03-01 |",
    ].join("\n");
    assert.deepEqual(found(source), []);
  });

  it("a table written without leading pipes is a sequence too; a line with a pipe in prose is not a table", () => {
    const table = ["# Plan", "", "Step | Date", "--- | ---", "a | 2026-04-01", "b | 2026-05-01", "c | 2026-04-15", "d | 2026-07-01"].join("\n");
    assert.deepEqual(found(table), ["April 15, 2026<May 1, 2026"]);
    const prose = ["# Notes", "", "a | 2026-04-01", "b | 2026-05-01", "c | 2026-04-15", "d | 2026-07-01"].join("\n");
    assert.deepEqual(found(prose), []);
  });

  it("a pipeless table's header holding a date is not part of the order", () => {
    const table = ["# Plan", "", "As of 2026-07-01 | Date", "--- | ---", "a | 2026-04-01", "b | 2026-05-01", "c | 2026-04-15", "d | 2026-07-01"].join("\n");
    assert.deepEqual(found(table), ["April 15, 2026<May 1, 2026"]);
  });

  it("a pipeless table ends at the first line without a pipe; a list after it is its own sequence", () => {
    const source = [
      "# Plan",
      "",
      "Step | Date",
      "--- | ---",
      "a | 2026-04-01",
      "b | 2026-05-01",
      "c | 2026-06-01",
      "",
      "- 2026-01-01 x",
      "- 2026-02-01 y",
    ].join("\n");
    assert.deepEqual(found(source), []);
  });

  it("a dash line with a pipe after a list item without one does not turn the item into a table header", () => {
    assert.deepEqual(found(`${list("2026-04-01", "2026-05-01", "2026-04-15", "2026-07-01")}\n--- | ---`), ["April 15, 2026<May 1, 2026"]);
  });

  it("a date in a table's header row is not part of the order", () => {
    const table = [
      "# Plan",
      "",
      "| As of 2026-07-01 | Date |",
      "| --- | --- |",
      "| a | 2026-04-01 |",
      "| b | 2026-05-01 |",
      "| c | 2026-04-15 |",
      "| d | 2026-07-01 |",
    ].join("\n");
    assert.deepEqual(found(table), ["April 15, 2026<May 1, 2026"]);
  });

  it("a list sorted by name, not by date, is not a schedule: most of its dates are off the order", () => {
    const releases = [
      "# Releases",
      "",
      "- widget-1.10.4 (legacy) was released on 2023-11-16.",
      "- widget-2.1.3 (LTS) was released on 2024-08-12.",
      "- widget-3.0.0 was released on 2023-08-21.",
      "- widget-cli-1.0.0 was released on 2024-02-17.",
    ].join("\n");
    assert.deepEqual(found(releases), []);
    assert.deepEqual(found(list("2024-02-01", "2023-10-01", "2024-06-01", "2023-12-01")), []);
  });

  it("a list with exactly half of its dates in order is not read as a schedule", () => {
    assert.deepEqual(found(list("2024-01-01", "2024-02-01", "2024-03-01", "2023-01-01", "2023-02-01", "2023-03-01")), []);
  });

  it("a list with more than half of its dates in order is still read as one; two slips in six are both pointed at", () => {
    assert.deepEqual(found(list("2026-01-01", "2026-02-01", "2026-03-01", "2026-01-15", "2026-01-20")), ["January 15, 2026<March 1, 2026"]);
    assert.deepEqual(found(list("2026-09-01", "2026-08-01", "2026-07-01", "2026-09-15", "2026-06-01")), ["September 15, 2026<July 1, 2026"]);
    assert.deepEqual(found(list("2026-01-01", "2026-02-01", "2026-01-15", "2026-03-01", "2026-04-01", "2026-03-15")), [
      "January 15, 2026<February 1, 2026",
      "March 15, 2026<April 1, 2026",
    ]);
  });

  it("the sample schedules: the English table's third row, not the newest-first history", () => {
    assert.deepEqual(found(readFileSync(new URL("fixtures/dates/schedule-en.md", import.meta.url), "utf8")), ["April 15, 2026<May 1, 2026"]);
  });

  it("the Japanese sample itinerary: the third day goes back a month", () => {
    const source = readFileSync(new URL("fixtures/dates/schedule-ja.md", import.meta.url), "utf8");
    assert.deepEqual(found(source, ja, "ja"), ["2026年9月3日<2026年10月2日"]);
  });
});

describe("date-order: a run of sibling headings", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  const sections = (heading: string, ...titles: string[]): string =>
    ["# Changelog", "", ...titles.flatMap((title) => [`${heading} ${title}`, "", "- A change.", ""])].join("\n");

  it("a newest-first changelog with one heading dated after the one above it", () => {
    const source = sections("##", "3.2.0 - 2026-09-14", "3.1.0 - 2026-10-02", "3.0.0 - 2026-03-20", "2.4.2 - 2026-01-11");
    assert.deepEqual(found(source), ["October 2, 2026<September 14, 2026"]);
  });

  it("the date in brackets after the version, and an oldest-first changelog", () => {
    const source = sections("##", "1.0.0 (2026-01-11)", "1.1.0 (2026-03-20)", "1.2.0 (2026-02-02)", "1.3.0 (2026-09-14)");
    assert.deepEqual(found(source), ["February 2, 2026<March 20, 2026"]);
  });

  it("a changelog in order, either way, is a right order", () => {
    assert.deepEqual(found(sections("##", "3.0.0 - 2026-09-14", "2.0.0 - 2026-06-02", "1.0.0 - 2026-03-20", "0.9.0 - 2026-01-11")), []);
    assert.deepEqual(found(sections("##", "0.9.0 - 2026-01-11", "1.0.0 - 2026-03-20", "2.0.0 - 2026-06-02", "3.0.0 - 2026-09-14")), []);
  });

  it("a heading without a date (Unreleased) is left out, and deeper headings (### Added) do not break the run", () => {
    const source = [
      "# Changelog",
      "",
      "## Unreleased",
      "",
      "## 3.2.0 - 2026-09-14",
      "### Added 2026-01-01",
      "## 3.1.0 - 2026-10-02",
      "### Fixed",
      "## 3.0.0 - 2026-03-20",
      "## 2.4.2 - 2026-01-11",
    ].join("\n");
    assert.deepEqual(found(source), ["October 2, 2026<September 14, 2026"]);
  });

  it("headings under different parents are separate runs", () => {
    const source = [
      "# Releases",
      "",
      "## 2026",
      "### 2026-09-14",
      "### 2026-06-02",
      "### 2026-03-20",
      "## 2025",
      "### 2025-01-11",
      "### 2025-06-02",
      "### 2025-09-14",
    ].join("\n");
    assert.deepEqual(found(source), []);
  });

  it("headings of different depths are not one run, and a heading with two dates (a period) is left out", () => {
    const mixed = ["# Log", "", "## 2026-09-14", "### 2026-10-02", "## 2026-06-02", "## 2026-03-20"].join("\n");
    assert.deepEqual(found(mixed), []);
    const period = sections("##", "Sprint 2026-09-01 to 2026-09-14", "Sprint 2026-10-01 to 2026-10-14", "3.0.0 - 2026-03-20", "2.0.0 - 2026-01-11");
    assert.deepEqual(found(period), []);
  });

  it("questions with an update date added to some of them are not sorted by date: an undated heading ends the run", () => {
    const faq = [
      "# FAQ",
      "",
      "## How do I change my address? (updated Sept. 13, 2022)",
      "## Can someone else see my account?",
      "## Is chat available? (updated Nov. 14, 2024)",
      "## Is there an app? (updated Oct. 3, 2023)",
      "## Can I use it abroad? (updated Nov. 21, 2022)",
    ].join("\n");
    assert.deepEqual(found(faq), []);
  });

  it("headings written inside list items are reported once, not once per sequence", () => {
    const source = ["# Releases", "", "- ## 3.2.0 - 2026-09-14", "- ## 3.1.0 - 2026-10-02", "- ## 3.0.0 - 2026-03-20", "- ## 2.4.2 - 2026-01-11"].join("\n");
    assert.deepEqual(found(source), ["October 2, 2026<September 14, 2026"]);
  });

  it("dates in the body under the headings are not the headings' order", () => {
    const source = [
      "# Notes",
      "",
      "## Kickoff",
      "",
      "Held on 2026-09-14.",
      "",
      "## Review",
      "",
      "Held on 2026-10-02.",
      "",
      "## Retro",
      "",
      "Held on 2026-03-20.",
    ].join("\n");
    assert.deepEqual(found(source), []);
  });

  it("a heading in a code fence is not a heading", () => {
    const source = [
      "# Example",
      "",
      "```markdown",
      "## 3.2.0 - 2026-09-14",
      "## 3.1.0 - 2026-10-02",
      "## 3.0.0 - 2026-03-20",
      "## 2.4.2 - 2026-01-11",
      "```",
    ].join("\n");
    assert.deepEqual(found(source), []);
  });

  it("Japanese headings, both ways", () => {
    const broken = sections("##", "3.2.0（2026年9月14日）", "3.1.0（2026年10月2日）", "3.0.0（2026年3月20日）", "2.4.2（2026年1月11日）");
    assert.deepEqual(found(broken, ja, "ja"), ["2026年10月2日<2026年9月14日"]);
    const right = sections("##", "3.2.0（2026年9月14日）", "3.1.0（2026年6月2日）", "3.0.0（2026年3月20日）", "2.4.2（2026年1月11日）");
    assert.deepEqual(found(right, ja, "ja"), []);
  });
});

describe("siblingHeadingRuns", () => {
  const heading = (depth: number, start: number): HeadingSpan => ({ depth, start, end: start + 1 });

  it("one run per depth under one parent; a shallower heading closes the deeper runs", () => {
    const runs = siblingHeadingRuns([heading(2, 0), heading(3, 1), heading(3, 2), heading(2, 3), heading(3, 4)]);
    assert.deepEqual(
      runs.map((run) => run.map((entry) => entry.start)),
      [[0, 3], [1, 2], [4]],
    );
  });

  it("no headings, no runs", () => {
    assert.deepEqual(siblingHeadingRuns([]), []);
  });
});

describe("longestInOrder", () => {
  it("counts the dates that can stay in the direction, skipping the ones off it", () => {
    assert.equal(longestInOrder(["2026-04-01", "2026-05-01", "2026-04-15", "2026-07-01"], 1), 3);
    assert.equal(longestInOrder(["2023-11-16", "2024-08-12", "2023-08-21", "2024-02-17"], 1), 2);
    assert.equal(longestInOrder(["2026-09-01", "2026-08-01", "2026-08-15", "2026-07-01"], -1), 3);
  });

  it("equal dates stay in order in either direction", () => {
    assert.equal(longestInOrder(["2026-04-01", "2026-04-01", "2026-04-01"], 1), 3);
    assert.equal(longestInOrder(["2026-04-01", "2026-04-01", "2026-04-01"], -1), 3);
  });

  it("the direction matters: an oldest-first list read newest-first keeps one date", () => {
    assert.equal(longestInOrder(["2026-01-01", "2026-02-01", "2026-03-01"], -1), 1);
    assert.equal(longestInOrder(["2026-03-01", "2026-02-01", "2026-01-01"], 1), 1);
  });

  it("empty and single lists", () => {
    assert.equal(longestInOrder([], 1), 0);
    assert.equal(longestInOrder(["2026-01-01"], -1), 1);
  });
});

const table = (...dates: string[]): string => ["# Plan", "", "| Date | Step |", "| --- | --- |", ...dates.map((date) => `| ${date} | step |`)].join("\n");
const headings = (...dates: string[]): string => ["# Changes", "", ...dates.flatMap((date) => [`## Release - ${date}`, "", "- A change.", ""])].join("\n");

describe("date-order: the date pointed at is the one out of place, not the one after it", () => {
  const shapes = { list, table, headings };

  Object.entries(shapes).forEach(([shape, write]) => {
    it(`a too-old date in a newest-first ${shape}`, () => {
      assert.deepEqual(found(write("2026-09-14", "2026-01-05", "2026-06-02", "2026-03-20", "2026-01-11")), ["January 5, 2026<September 14, 2026"]);
    });

    it(`a too-new date in a newest-first ${shape}`, () => {
      assert.deepEqual(found(write("2026-09-14", "2026-06-02", "2026-12-01", "2026-03-20", "2026-01-11")), ["December 1, 2026<June 2, 2026"]);
    });

    it(`a too-new date in an oldest-first ${shape}`, () => {
      assert.deepEqual(found(write("2026-01-11", "2026-03-20", "2026-12-01", "2026-06-02", "2026-09-14")), ["December 1, 2026<March 20, 2026"]);
    });

    it(`a too-old date in an oldest-first ${shape}`, () => {
      assert.deepEqual(found(write("2026-01-11", "2026-03-20", "2026-06-02", "2026-01-01", "2026-09-14")), ["January 1, 2026<June 2, 2026"]);
    });

    it(`two neighbours swapped in a ${shape}: the one farther from its outer neighbour is pointed at`, () => {
      assert.deepEqual(found(write("2026-09-14", "2026-05-08", "2026-06-02", "2026-03-20", "2026-01-11")), ["May 8, 2026<September 14, 2026"]);
      assert.deepEqual(found(write("2026-09-14", "2026-07-08", "2026-08-02", "2026-03-20", "2026-01-11")), ["August 2, 2026<July 8, 2026"]);
    });

    it(`two neighbours swapped in a ${shape} as far from their outer neighbours: the later one, as before`, () => {
      assert.deepEqual(found(write("2026-08-31", "2026-06-01", "2026-07-01", "2026-04-01", "2026-01-11")), ["July 1, 2026<June 1, 2026"]);
    });

    it(`a ${shape} in order, or of two dates, says nothing`, () => {
      assert.deepEqual(found(write("2026-09-14", "2026-06-02", "2026-03-20", "2026-01-11")), []);
      assert.deepEqual(found(write("2026-01-11", "2026-03-20", "2026-06-02", "2026-09-14")), []);
      assert.deepEqual(found(write("2026-01-11", "2026-09-14")), []);
      assert.deepEqual(found(write("2026-09-14", "2026-01-11")), []);
    });
  });

  it("two steps against the order that blame the same date report it once", () => {
    assert.deepEqual(found(list("2026-01-01", "2026-02-01", "2026-06-01", "2026-05-01", "2026-03-01", "2026-04-01")), ["May 1, 2026<June 1, 2026"]);
  });

  it("equal dates next to the one out of place stay in order", () => {
    assert.deepEqual(found(list("2026-01-01", "2026-03-01", "2026-02-01", "2026-02-01", "2026-04-01")), ["March 1, 2026<January 1, 2026"]);
  });

  it("a first date out of place is pointed at, with the date after it", () => {
    assert.deepEqual(found(list("2026-01-01", "2026-09-01", "2026-08-01", "2026-07-01")), ["January 1, 2026>September 1, 2026"]);
  });
});

describe("date-order: a tie broken by the versions on the same lines", () => {
  const releases = (...lines: string[]): string => ["# Releases", "", ...lines.map((line) => `- ${line}`)].join("\n");

  it("versions in order back the positions: the date against more of the others is pointed at", () => {
    const source = releases("1.0.0 (2026-01-10)", "1.1.0 (2026-04-10)", "1.2.0 (2026-01-05)", "1.3.0 (2026-02-10)", "1.4.0 (2026-03-10)");
    assert.deepEqual(found(source), ["April 10, 2026<January 10, 2026"]);
  });

  it("without versions, or with versions out of order, the same dates keep the later one", () => {
    assert.deepEqual(found(list("2026-01-10", "2026-04-10", "2026-01-05", "2026-02-10", "2026-03-10")), ["January 5, 2026<April 10, 2026"]);
    const source = releases("1.0.0 (2026-01-10)", "1.1.0 (2026-04-10)", "1.2.0 (2026-01-05)", "1.4.0 (2026-02-10)", "1.3.0 (2026-03-10)");
    assert.deepEqual(found(source), ["January 5, 2026<April 10, 2026"]);
  });

  it("a changelog whose versions are out of order too falls back to the gap (the swapped pair stays inside its neighbours)", () => {
    const source = [
      "# Changelog",
      "",
      ...["3.2.0 - 2026-09-14", "3.1.1 - 2026-05-08", "3.3.0 - 2026-06-02", "3.0.0 - 2026-03-20"].flatMap((title) => [`## ${title}`, "", "- A change.", ""]),
    ].join("\n");
    assert.deepEqual(found(source), ["May 8, 2026<September 14, 2026"]);
  });
});

describe("breakDateTie", () => {
  const NEWEST_FIRST = -1;
  const OLDEST_FIRST = 1;
  const dates = (...values: string[]) => values.map((value) => ({ value, version: undefined }));

  it("a swap inside its outer neighbours: the side farther from its outer neighbour", () => {
    assert.equal(breakDateTie(dates("2026-09-14", "2026-05-08", "2026-06-02", "2026-03-20"), 1, 2, NEWEST_FIRST), 1);
    assert.equal(breakDateTie(dates("2026-01-10", "2026-01-20", "2026-01-15", "2026-03-25"), 1, 2, OLDEST_FIRST), 2);
    assert.equal(breakDateTie(dates("2026-01", "2026-06", "2026-03", "2026-12"), 1, 2, OLDEST_FIRST), 2);
    assert.equal(breakDateTie(dates("12-01", "05-01", "07-01", "04-01"), 1, 2, NEWEST_FIRST), 1);
  });

  it("no decision: equal gaps, a pair at either end, a pair outside its neighbours, or dates that are not dates", () => {
    assert.equal(breakDateTie(dates("2026-08-31", "2026-06-01", "2026-07-01", "2026-04-01"), 1, 2, NEWEST_FIRST), undefined);
    assert.equal(breakDateTie(dates("2026-06-01", "2026-09-01", "2026-03-01"), 0, 1, NEWEST_FIRST), undefined);
    assert.equal(breakDateTie(dates("2026-09-01", "2026-03-01", "2026-06-01"), 1, 2, NEWEST_FIRST), undefined);
    assert.equal(breakDateTie(dates("2026-01-01", "2026-02-01", "2026-03-01", "2026-01-15", "2026-01-20"), 2, 3, OLDEST_FIRST), undefined);
    assert.equal(breakDateTie(dates("09:00", "11:00", "10:00", "12:00"), 1, 2, OLDEST_FIRST), undefined);
    assert.equal(breakDateTie([], 1, 2, OLDEST_FIRST), undefined);
  });

  it("versions in order decide by how many other dates each one is against", () => {
    const entries = ["2026-01-10", "2026-04-10", "2026-01-05", "2026-02-10", "2026-03-10"].map((value, index) => ({ value, version: `1.${index}.0` }));
    assert.equal(breakDateTie(entries, 1, 2, OLDEST_FIRST), 1);
  });

  it("versions with one missing or out of order are no evidence", () => {
    const values = ["2026-01-10", "2026-04-10", "2026-01-05", "2026-02-10", "2026-03-10"];
    const missing = values.map((value, index) => ({ value, version: index === 3 ? undefined : `1.${index}.0` }));
    const backwards = values.map((value, index) => ({ value, version: `1.${values.length - index}.0` }));
    assert.equal(breakDateTie(missing, 1, 2, OLDEST_FIRST), undefined);
    assert.equal(breakDateTie(backwards, 1, 2, OLDEST_FIRST), undefined);
  });
});

describe("outOfPlace", () => {
  const NEWEST_FIRST = -1;
  const OLDEST_FIRST = 1;

  it("the earlier side of the step when removing it leaves more in order", () => {
    assert.equal(outOfPlace(["2026-09", "2026-01", "2026-06", "2026-03"], 2, NEWEST_FIRST), 1);
    assert.equal(outOfPlace(["2026-01", "2026-03", "2026-12", "2026-06", "2026-09"], 3, OLDEST_FIRST), 2);
  });

  it("the later side when removing it leaves more in order", () => {
    assert.equal(outOfPlace(["2026-09", "2026-06", "2026-12", "2026-03"], 2, NEWEST_FIRST), 2);
    assert.equal(outOfPlace(["2026-01", "2026-03", "2026-06", "2026-01", "2026-09"], 3, OLDEST_FIRST), 3);
  });

  it("a tie (two neighbours swapped) keeps the later side, unless the tie-break decides", () => {
    assert.equal(
      outOfPlace(["2026-09", "2026-05", "2026-06", "2026-03"], 2, NEWEST_FIRST, () => 1),
      1,
    );
    assert.equal(
      outOfPlace(["2026-09", "2026-01", "2026-06", "2026-03"], 2, NEWEST_FIRST, () => 2),
      1,
    );
    assert.equal(outOfPlace(["2026-09", "2026-05", "2026-06", "2026-03"], 2, NEWEST_FIRST), 2);
    assert.equal(outOfPlace(["2026-01", "2026-06", "2026-05", "2026-09"], 2, OLDEST_FIRST), 2);
  });

  it("the first date when removing it leaves more in order, and a step at the start of a two-date list stays on the later side", () => {
    assert.equal(outOfPlace(["2026-01", "2026-09", "2026-08", "2026-07"], 1, NEWEST_FIRST), 0);
    assert.equal(outOfPlace(["2026-09", "2026-01", "2026-03", "2026-06"], 1, OLDEST_FIRST), 0);
    assert.equal(outOfPlace(["2026-09", "2026-01"], 1, OLDEST_FIRST), 1);
  });

  it("a tie at the start (the first two swapped) keeps the later side", () => {
    assert.equal(outOfPlace(["2026-06", "2026-09", "2026-03", "2026-01"], 1, NEWEST_FIRST), 1);
    assert.equal(outOfPlace(["2026-03", "2026-01", "2026-06", "2026-09"], 1, OLDEST_FIRST), 1);
  });
});

describe("date-order: a first date out of place", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  const messages = (source: string, adapter: LanguageAdapter = en, language = "en"): string[] => {
    const rules = loadRules(language);
    const rule = rules.find((entry) => entry.id === "date-order");
    return runRules(buildDocument("t.md", source, adapter), rules, { "date-order": "normal" }, false, "business/report")
      .findings.filter((finding) => finding.rule === "date-order")
      .map((finding) => (rule === undefined ? "" : messageOf(rule, finding, language)));
  };

  const shapes = { list, table, headings };

  Object.entries(shapes).forEach(([shape, write]) => {
    it(`a too-old first date in a newest-first ${shape} is pointed at, before the next date`, () => {
      assert.deepEqual(messages(write("2026-01-05", "2026-09-14", "2026-06-02", "2026-03-20")), [
        "January 5, 2026 breaks the order of the dates after it (before September 14, 2026)",
      ]);
    });

    it(`a too-new first date in an oldest-first ${shape} is pointed at, before the next date`, () => {
      assert.deepEqual(messages(write("2026-12-01", "2026-01-11", "2026-03-20", "2026-06-02")), [
        "December 1, 2026 breaks the order of the dates after it (before January 11, 2026)",
      ]);
    });

    it(`the first two dates swapped in a ${shape} cannot be told apart: the second one is pointed at, as before`, () => {
      assert.deepEqual(messages(write("2026-06-02", "2026-09-14", "2026-03-20", "2026-01-11")), [
        "September 14, 2026 breaks the order of the dates around it (after June 2, 2026)",
      ]);
    });

    it(`a ${shape} in order says nothing, either way`, () => {
      assert.deepEqual(messages(write("2026-09-14", "2026-06-02", "2026-03-20", "2026-01-05")), []);
      assert.deepEqual(messages(write("2026-01-05", "2026-03-20", "2026-06-02", "2026-09-14")), []);
    });
  });

  it("the Japanese message names the next date", () => {
    const source = ["# 予定", "", "- 2026年1月5日 出発", "- 2026年9月14日 視察", "- 2026年6月2日 会議", "- 2026年3月20日 帰国"].join("\n");
    assert.deepEqual(messages(source, ja, "ja"), ["「2026年1月5日」が、後の日付の並びから外れています（次は「2026年9月14日」）"]);
  });
});
