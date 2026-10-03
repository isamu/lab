import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { HEAVY_FILES, parsePart, partFiles } from "../scripts/test-parts.ts";

const FILES = ["test/test_a.ts", ...HEAVY_FILES, "test/test_b.ts", "test/test_c.ts", "test/test_d.ts", "examples/x/test/test_e.mjs"];

describe("partFiles", () => {
  it("どの分け方でも、全部の部分を合わせると元の一覧になり、二つの部分に入るファイルは無い", () => {
    [1, 2, 3, 4, 5, 8].forEach((parts) => {
      const all = Array.from({ length: parts }, (_, index) => partFiles(FILES, index + 1, parts)).flat();
      assert.equal(all.length, FILES.length, `${parts} parts`);
      assert.deepEqual(new Set(all), new Set(FILES), `${parts} parts`);
    });
  });

  it("部分 1 は重いファイルだけ、残りはほかのファイルを順に分ける", () => {
    assert.deepEqual(partFiles(FILES, 1, 3), HEAVY_FILES);
    assert.deepEqual(partFiles(FILES, 2, 3), ["test/test_a.ts", "test/test_c.ts", "examples/x/test/test_e.mjs"]);
    assert.deepEqual(partFiles(FILES, 3, 3), ["test/test_b.ts", "test/test_d.ts"]);
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
