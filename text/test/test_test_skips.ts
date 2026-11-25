import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { OWN_JOB_FILES } from "../scripts/test-parts.ts";
import { parseRun, parseSkipTable, runFiles, skippedFiles, type SkipTable, type TestRun } from "../scripts/test-skips.ts";
import { parseTimesTable } from "../scripts/test-times.ts";

const TEXT = join(import.meta.dirname, "..");
const TABLE = parseSkipTable(readFileSync(join(TEXT, "scripts", "test-skips.json"), "utf8"));
const TIMES = parseTimesTable(readFileSync(join(TEXT, "scripts", "test-times.json"), "utf8"));
const WINDOWS_LISTED = Object.keys(TABLE.win32 ?? {});
const OTHER_PLATFORMS = ["linux", "darwin"];
const PART_COUNTS = [1, 2, 4, 5];
const SEEDS = Array.from({ length: 100 }, (_, index) => index + 1);
const GENERATED_FILES_MAX = 80;
const GENERATED_TIME_MAX_MS = 300_000;
const LISTED_SHARE = 0.3;
const MEASURED_SHARE = 0.8;
const RUNS: readonly TestRun[] = ["pr", "full"];
const SETTINGS = ["win32", "linux"].flatMap((platform) => RUNS.flatMap((run) => PART_COUNTS.map((parts) => ({ platform, run, parts }))));

/** A small deterministic generator, so a failing case can be rerun from its seed. */
const randomFrom = (seed: number): (() => number) => {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 2 ** 32;
  };
};

/** Generated files with some of them listed for win32, and times for most of them. */
const generatedCase = (seed: number): { files: string[]; table: SkipTable; times: Record<string, number> } => {
  const random = randomFrom(seed);
  const files = Array.from({ length: 1 + Math.floor(random() * GENERATED_FILES_MAX) }, (_, index) => `test/test_${seed}_${index}.ts`);
  const listed = files.filter(() => random() < LISTED_SHARE);
  const times: Record<string, number> = {};
  files.filter(() => random() < MEASURED_SHARE).forEach((file) => (times[file] = Math.floor(random() ** 3 * GENERATED_TIME_MAX_MS)));
  return { files: [...files, ...OWN_JOB_FILES], table: { win32: Object.fromEntries(listed.map((file) => [file, "generated"])) }, times };
};

const allParts = (files: readonly string[], parts: number, times: Record<string, number>, skipped: readonly string[]): string[] =>
  Array.from({ length: parts }, (_, index) => runFiles(files, index + 1, parts, times, skipped)).flat();

const expectedRun = (files: readonly string[], parts: number, skipped: readonly string[]): string[] =>
  files.filter((file) => !skipped.includes(file) && (parts === 1 || !OWN_JOB_FILES.includes(file)));

describe("skippedFiles", () => {
  it("pull-request の実行では、Windows は表に挙げたファイルをちょうど除き、ほかの OS は何も除かない", () => {
    assert.ok(WINDOWS_LISTED.length > 0);
    assert.deepEqual(skippedFiles(TABLE, "win32", "pr"), WINDOWS_LISTED);
    OTHER_PLATFORMS.forEach((platform) => assert.deepEqual(skippedFiles(TABLE, platform, "pr"), [], platform));
  });

  it("毎日の full の実行では、どの OS でも何も除かない", () => {
    ["win32", ...OTHER_PLATFORMS].forEach((platform) => assert.deepEqual(skippedFiles(TABLE, platform, "full"), [], platform));
  });

  it("表に挙げたファイルはどれも実在する（消えたファイルが残ると、除いたつもりで何も除かない）", () => {
    WINDOWS_LISTED.forEach((file) => assert.ok(existsSync(join(TEXT, file)), file));
  });
});

describe("runFiles", () => {
  it("実際のファイルと時間表で、Windows の pull-request の部分は挙げたファイルを含まず、残りのファイルをちょうど一度ずつ持つ", () => {
    const files = Object.keys(TIMES);
    const skipped = skippedFiles(TABLE, "win32", "pr");
    const all = allParts(files, 4, TIMES, skipped);
    WINDOWS_LISTED.forEach((file) => assert.ok(!all.includes(file), file));
    assert.equal(all.length, new Set(all).size);
    assert.deepEqual(new Set(all), new Set(expectedRun(files, 4, skipped)));
  });

  it("作った一覧でも、除かないファイルはどれもちょうど一つの部分に入る（pr と full、どの OS でも）", () => {
    SEEDS.forEach((seed) => {
      const { files, table, times } = generatedCase(seed);
      SETTINGS.forEach(({ platform, run, parts }) => {
        const skipped = skippedFiles(table, platform, run);
        const all = allParts(files, parts, times, skipped);
        const label = `seed ${seed}, ${platform}, ${run}, ${parts} parts`;
        assert.equal(all.length, new Set(all).size, label);
        assert.deepEqual(new Set(all), new Set(expectedRun(files, parts, skipped)), label);
      });
    });
  });
});

describe("parseSkipTable", () => {
  it("理由の無いファイル、表でない値は止まる", () => {
    ['{"win32": {"test/test_a.ts": ""}}', '{"win32": {"test/test_a.ts": 3}}', '{"win32": ["test/test_a.ts"]}', "[]", "null", '"x"'].forEach((json) =>
      assert.throws(() => parseSkipTable(json), /test skips/u, json),
    );
  });

  it("壊れた JSON は止まる", () => {
    assert.throws(() => parseSkipTable("{"));
  });

  it("空の表は何も除かない", () => {
    assert.deepEqual(skippedFiles(parseSkipTable("{}"), "win32", "pr"), []);
  });
});

describe("parseRun", () => {
  it("--run pr|full を読み、ほかの引数は順のまま残す", () => {
    assert.deepEqual(parseRun(["--part", "2/4", "--run", "pr", "--test-only"]), { run: "pr", rest: ["--part", "2/4", "--test-only"] });
    assert.deepEqual(parseRun(["--run", "full"]), { run: "full", rest: [] });
  });

  it("--run が無ければ full（何も除かない）", () => {
    assert.deepEqual(parseRun(["--part", "1/4"]), { run: "full", rest: ["--part", "1/4"] });
  });

  it("--run の後ろが pr か full でなければ止まる", () => {
    [["--run"], ["--run", "daily"], ["--run", "--part"]].forEach((args) => assert.throws(() => parseRun(args), /--run takes/u, args.join(" ")));
  });
});
