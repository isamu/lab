import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  HEAVY_FILES,
  HEAVY_FILE_WIDTH,
  OWN_JOB_FILES,
  UNMEASURED_FILE_MS,
  balancedParts,
  parsePart,
  partFiles,
  type TestTimes,
} from "../scripts/test-parts.ts";

const FILES = ["test/test_a.ts", ...HEAVY_FILES, "test/test_b.ts", "test/test_c.ts", ...OWN_JOB_FILES, "test/test_d.ts", "examples/x/test/test_e.mjs"];
const SPLIT_FILES = FILES.filter((file) => !OWN_JOB_FILES.includes(file));
const PART_COUNTS = [1, 2, 3, 4, 5, 8];
const SEEDS = Array.from({ length: 200 }, (_, index) => index + 1);
const GENERATED_FILES_MAX = 60;
const MEASURED_SHARE = 0.8;
const GENERATED_TIME_MAX_MS = 400_000;

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

/** A generated file list with the heavy and own-job files mixed in, and a table that times most of the files but not all (skewed toward short files). */
const generatedCase = (seed: number): { files: string[]; times: Record<string, number> } => {
  const random = randomFrom(seed);
  const plain = Array.from({ length: 1 + Math.floor(random() * GENERATED_FILES_MAX) }, (_, index) => `test/test_${seed}_${index}.ts`);
  const files = [...plain, ...HEAVY_FILES, ...OWN_JOB_FILES].toSorted((left, right) => left.localeCompare(right, "en"));
  const times: Record<string, number> = {};
  files.filter(() => random() < MEASURED_SHARE).forEach((file) => (times[file] = Math.floor(random() ** 3 * GENERATED_TIME_MAX_MS)));
  return { files, times };
};

const allParts = (files: readonly string[], parts: number, times: TestTimes): string[][] =>
  Array.from({ length: parts }, (_, index) => partFiles(files, index + 1, parts, times));

const assertEveryFileOnce = (seed: number, parts: number): void => {
  const { files, times } = generatedCase(seed);
  const all = allParts(files, parts, times).flat();
  const expected = files.filter((file) => !OWN_JOB_FILES.includes(file));
  assert.equal(all.length, expected.length, `seed ${seed}, ${parts} parts`);
  assert.deepEqual(new Set(all), new Set(expected), `seed ${seed}, ${parts} parts`);
};

/** Each part's time as the split counts it, and the gap between the longest and the shortest part (part 1 left out when it holds only the heavy files). */
const loadSpread = (seed: number): { spread: number; longestFile: number; loads: number[] } => {
  const { files, times } = generatedCase(seed);
  const rest = files.filter((file) => !HEAVY_FILES.includes(file) && !OWN_JOB_FILES.includes(file));
  const known = rest.map((file) => times[file]).filter((ms) => ms !== undefined);
  const middle = known.toSorted((left, right) => left - right)[Math.floor(known.length / 2)] ?? UNMEASURED_FILE_MS;
  const time = (file: string): number => times[file] ?? middle;
  const heavyLoad = Math.max(...HEAVY_FILES.map(time)) * HEAVY_FILE_WIDTH;
  const parts = balancedParts(files, 4, times);
  const plainTime = (part: readonly string[]): number => part.filter((file) => !HEAVY_FILES.includes(file)).reduce((sum, file) => sum + time(file), 0);
  const loads = parts.map((part, index) => plainTime(part) + (index === 0 ? heavyLoad : 0));
  const onlyHeavyInPartOne = parts[0]?.every((file) => HEAVY_FILES.includes(file)) === true;
  const spread = Math.max(...loads.slice(onlyHeavyInPartOne ? 1 : 0)) - Math.min(...loads);
  return { spread, longestFile: Math.max(0, ...rest.map(time)), loads };
};

describe("partFiles", () => {
  it("どの分け方でも、全部の部分を合わせると元の一覧（分けるときは自分の job で走るファイルを除く）になり、二つの部分に入るファイルは無い", () => {
    PART_COUNTS.forEach((parts) => {
      const all = allParts(FILES, parts, {}).flat();
      const expected = parts === 1 ? FILES : SPLIT_FILES;
      assert.equal(all.length, expected.length, `${parts} parts`);
      assert.deepEqual(new Set(all), new Set(expected), `${parts} parts`);
    });
  });

  it("作った一覧と時間表でも、どのファイルもちょうど一つの部分に入る（表に無い新しいファイルも走る）", () => {
    SEEDS.forEach((seed) => PART_COUNTS.filter((parts) => parts > 1).forEach((parts) => assertEveryFileOnce(seed, parts)));
  });

  it("重いファイルは部分 1 に入り、どの部分もファイルの順を保つ", () => {
    const { files, times } = generatedCase(7);
    const parts = allParts(files, 4, times);
    HEAVY_FILES.forEach((file) => assert.ok(parts[0]?.includes(file), file));
    parts.forEach((part) =>
      assert.deepEqual(
        part,
        files.filter((file) => part.includes(file)),
      ),
    );
  });

  it("部分の時間は揃う: 最も長い部分と最も短い部分の差は、一番長いファイル一つ分を超えない（部分 1 が重いファイルだけで一番長いときを除く）", () => {
    SEEDS.forEach((seed) => {
      const { spread, longestFile, loads } = loadSpread(seed);
      assert.ok(spread <= longestFile, `seed ${seed}: loads ${loads.join(", ")}, longest file ${longestFile}`);
    });
  });

  it("時間で分ける: 長いファイルは別々の部分に入り、短いファイルが空いた部分を埋める", () => {
    const files = ["test/test_long1.ts", "test/test_long2.ts", "test/test_short1.ts", "test/test_short2.ts", "test/test_short3.ts", "test/test_short4.ts"];
    const times = {
      "test/test_long1.ts": 100,
      "test/test_long2.ts": 100,
      "test/test_short1.ts": 50,
      "test/test_short2.ts": 50,
      "test/test_short3.ts": 50,
      "test/test_short4.ts": 50,
    };
    assert.deepEqual(balancedParts(files, 2, times), [
      ["test/test_long1.ts", "test/test_short1.ts", "test/test_short3.ts"],
      ["test/test_long2.ts", "test/test_short2.ts", "test/test_short4.ts"],
    ]);
  });

  it("重いファイルの時間が長ければ、部分 1 にはほかのファイルを入れない", () => {
    const times = {
      [HEAVY_FILES[0] ?? ""]: 1_000_000,
      "test/test_a.ts": 10,
      "test/test_b.ts": 10,
      "test/test_c.ts": 10,
      "test/test_d.ts": 10,
      "examples/x/test/test_e.mjs": 10,
    };
    assert.deepEqual(partFiles(FILES, 1, 3, times), HEAVY_FILES);
  });

  it("表の壊れた値（負、NaN、無限）は測っていないものとして扱い、同じ入力からはいつも同じ分け方になる", () => {
    const broken = { "test/test_a.ts": -5, "test/test_b.ts": Number.NaN, "test/test_c.ts": Number.POSITIVE_INFINITY };
    assert.deepEqual(balancedParts(FILES, 3, broken), balancedParts(FILES, 3, {}));
    const { files, times } = generatedCase(11);
    assert.deepEqual(balancedParts(files, 4, times), balancedParts([...files], 4, { ...times }));
  });

  it("一つに分けるなら全部", () => {
    assert.deepEqual(partFiles(FILES, 1, 1), FILES);
  });

  it("無い部分を頼むと止まる", () => {
    [
      [0, 3],
      [4, 3],
      [1, 0],
      [1.5, 3],
      [2, Number.NaN],
    ].forEach(([part = 0, parts = 0]) => assert.throws(() => partFiles(FILES, part, parts), /no part/u, `${part}/${parts}`));
  });
});

describe("parsePart", () => {
  it("--part <i>/<n> を読み、ほかの引数は順のまま node に残す", () => {
    assert.deepEqual(parsePart(["--test-reporter=tap", "--part", "2/5", "--test-only"]), { part: 2, parts: 5, rest: ["--test-reporter=tap", "--test-only"] });
  });

  it("--part が無ければ、全体で一つの部分", () => {
    assert.deepEqual(parsePart([]), { part: 1, parts: 1, rest: [] });
    assert.deepEqual(parsePart(["--test-reporter=tap"]), { part: 1, parts: 1, rest: ["--test-reporter=tap"] });
  });

  it("--part の後ろが <i>/<n> でなければ止まる", () => {
    [["--part"], ["--part", "2"], ["--part", "a/b"], ["--part", "2/5/1"], ["--part", "-1/5"]].forEach((args) =>
      assert.throws(() => parsePart(args), /--part takes/u, args.join(" ")),
    );
  });
});
