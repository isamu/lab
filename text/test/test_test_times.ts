import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { TIME_MARK, addEndedTest, parseTimesTable, relativeTestPath, timeLines, timesFromLogs, timesTable, type EndedTest } from "../scripts/test-times.ts";

const ROOT = "/work/text";
const ended = (type: string, nesting: number | undefined, file: string | undefined, ms: number | undefined): EndedTest => ({
  type,
  data: { nesting, file, details: { duration_ms: ms } },
});

describe("relativeTestPath", () => {
  it("text/ からの道筋を、どの OS でも / で書く", () => {
    assert.equal(relativeTestPath("/work/text/test/test_a.ts", ROOT), "test/test_a.ts");
    assert.equal(relativeTestPath("/work/text/test/test_a.ts", "/work/text/"), "test/test_a.ts");
    assert.equal(relativeTestPath("D:\\a\\lab\\text\\test\\test_a.ts", "D:\\a\\lab\\text"), "test/test_a.ts");
  });

  it("root の外のファイルは、/ にしたそのままの道筋", () => {
    assert.equal(relativeTestPath("/elsewhere/test_a.ts", ROOT), "/elsewhere/test_a.ts");
    assert.equal(relativeTestPath("/work/textual/test_a.ts", ROOT), "/work/textual/test_a.ts");
  });
});

describe("addEndedTest", () => {
  it("ファイルの時間は、終わった一番外のテストと suite の時間の和（通っても落ちても数える）", () => {
    const totals = new Map<string, number>();
    [
      ended("test:pass", 0, "/work/text/test/test_a.ts", 100),
      ended("test:fail", 0, "/work/text/test/test_a.ts", 50),
      ended("test:pass", 0, "/work/text/test/test_b.ts", 7),
    ].forEach((event) => addEndedTest(totals, event, ROOT));
    assert.deepEqual(
      [...totals],
      [
        ["test/test_a.ts", 150],
        ["test/test_b.ts", 7],
      ],
    );
  });

  it("内側のテスト、ほかの種類の event、欠けた値は数えない", () => {
    const totals = new Map<string, number>();
    [
      ended("test:pass", 1, "/work/text/test/test_a.ts", 100),
      ended("test:start", 0, "/work/text/test/test_a.ts", 100),
      ended("test:diagnostic", 0, "/work/text/test/test_a.ts", 100),
      ended("test:pass", undefined, "/work/text/test/test_a.ts", 100),
      ended("test:pass", 0, undefined, 100),
      ended("test:pass", 0, "/work/text/test/test_a.ts", undefined),
      ended("test:pass", 0, "/work/text/test/test_a.ts", Number.NaN),
      { type: "test:pass" },
    ].forEach((event) => addEndedTest(totals, event, ROOT));
    assert.equal(totals.size, 0);
  });
});

describe("timeLines と timesFromLogs", () => {
  it("書いた行を CI のログ（時刻が前に付き、行末が CRLF）から読み戻せる", () => {
    const totals = new Map([
      ["test/test_b.ts", 2.6],
      ["test/test_a.ts", 1234.4],
    ]);
    const lines = timeLines(totals);
    assert.deepEqual(lines, [`${TIME_MARK}\t1234\ttest/test_a.ts`, `${TIME_MARK}\t3\ttest/test_b.ts`]);
    const log = ["2026-11-24T12:00:00.0000000Z ✔ something (5ms)", ...lines.map((line) => `2026-11-24T12:00:01.0000000Z ${line}`), ""].join("\r\n");
    assert.deepEqual(
      [...timesFromLogs([log])],
      [
        ["test/test_a.ts", 1234],
        ["test/test_b.ts", 3],
      ],
    );
  });

  it("いくつものログにあるファイルは長いほうの時間、印の無い行や形の違う行は読まない", () => {
    const first = `${TIME_MARK}\t10\ttest/test_a.ts\n${TIME_MARK}\tx\ttest/test_b.ts\n${TIME_MARK} 10 test/test_c.ts\nchaff-test-file\t10\ttest/test_d.ts`;
    const second = `${TIME_MARK}\t30\ttest/test_a.ts\n`;
    assert.deepEqual([...timesFromLogs([first, second])], [["test/test_a.ts", 30]]);
    assert.equal(timesFromLogs([]).size, 0);
    assert.equal(timesFromLogs([""]).size, 0);
  });

  it("job を指すと、gh run view --log の行のうち、その名前で始まる job の行だけを読む", () => {
    const log = [
      `test (windows-latest, part 2/4)\ttest\t2026-11-24T12:00:00Z ${TIME_MARK}\t40\ttest/test_a.ts`,
      `test (ubuntu-latest, part 2/4)\ttest\t2026-11-24T12:00:00Z ${TIME_MARK}\t90\ttest/test_a.ts`,
      `test (ubuntu-latest, part 3/4)\ttest\t2026-11-24T12:00:00Z ${TIME_MARK}\t90\ttest/test_b.ts`,
    ].join("\n");
    assert.deepEqual([...timesFromLogs([log], "test (windows-latest")], [["test/test_a.ts", 40]]);
    assert.deepEqual(
      [...timesFromLogs([log])],
      [
        ["test/test_a.ts", 90],
        ["test/test_b.ts", 90],
      ],
    );
  });
});

describe("timesTable と parseTimesTable", () => {
  it("道筋の順に一行ずつ書き、読み戻すと同じ表", () => {
    const table = timesTable(
      new Map([
        ["test/test_b.ts", 5],
        ["test/test_a.ts", 9],
      ]),
    );
    assert.equal(table, '{\n  "test/test_a.ts": 9,\n  "test/test_b.ts": 5\n}\n');
    assert.deepEqual(parseTimesTable(table), { "test/test_a.ts": 9, "test/test_b.ts": 5 });
  });

  it("数でない値、負の値、表でない JSON は除く", () => {
    assert.deepEqual(parseTimesTable('{"test/test_a.ts": "9", "test/test_b.ts": -1, "test/test_c.ts": null, "test/test_d.ts": 4}'), { "test/test_d.ts": 4 });
    ["[]", "null", "3", '"x"'].forEach((json) => assert.deepEqual(parseTimesTable(json), {}, json));
    assert.throws(() => parseTimesTable("{"));
  });

  it("入っている表は読めて、空でない", () => {
    const committed = parseTimesTable(readFileSync(join(import.meta.dirname, "..", "scripts", "test-times.json"), "utf8"));
    assert.ok(Object.keys(committed).length > 0);
  });
});

describe("test-times-reporter", () => {
  it("node --test にかけると、ファイルごとの時間の行を出す", () => {
    const folder = mkdtempSync(join(tmpdir(), "chaff-test-times-"));
    try {
      writeFileSync(join(folder, "test_x.mjs"), 'import { test } from "node:test";\ntest("one", () => {});\ntest("two", () => {});\n');
      const reporter = pathToFileURL(join(import.meta.dirname, "..", "scripts", "test-times-reporter.ts")).href;
      // Under node --test, NODE_TEST_CONTEXT makes a child run report to its parent instead of to the reporter it is given.
      const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => name !== "NODE_TEST_CONTEXT"));
      const run = spawnSync(process.execPath, ["--test", `--test-reporter=${reporter}`, "--test-reporter-destination=stdout", "test_x.mjs"], {
        cwd: folder,
        encoding: "utf8",
        env,
      });
      assert.equal(run.status, 0, run.stderr);
      assert.deepEqual([...timesFromLogs([run.stdout]).keys()], ["test_x.mjs"]);
      assert.match(run.stdout, /::group::test file times/u);
    } finally {
      rmSync(folder, { recursive: true, force: true });
    }
  });
});
