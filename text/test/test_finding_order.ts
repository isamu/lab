import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { byPosition } from "../packages/chaff/src/finding-order.ts";

const at = (line: number, column: number): { line: number; column: number } => ({ line, column });

describe("byPosition", () => {
  it("行の順、同じ行では桁の順", () => {
    const sorted = [at(852, 14), at(41, 147), at(852, 6), at(41, 109), at(852, 17)].toSorted(byPosition);
    assert.deepEqual(sorted, [at(41, 109), at(41, 147), at(852, 6), at(852, 14), at(852, 17)]);
  });

  it("同じ位置は元の順を保つ", () => {
    const first = { ...at(3, 2), rule: "a" };
    const second = { ...at(3, 2), rule: "b" };
    assert.deepEqual([first, second].toSorted(byPosition), [first, second]);
    assert.equal(byPosition(at(1, 1), at(1, 1)), 0);
  });

  it("前の行は桁が大きくても先", () => {
    assert.ok(byPosition(at(1, 900), at(2, 1)) < 0);
    assert.ok(byPosition(at(2, 1), at(1, 900)) > 0);
  });
});

describe("指摘の並び", () => {
  // 一行に「後ろの数字」と「前の数字」の指摘が二つずつ。向きごとにまとめず、桁の順に出す。
  const source =
    "# 報告\n\n作業は3日で終わり、費用は5万円でした。\n部品は8個で、検査は2回です。\n人員は4人で、会議は6回でした。\n今回は 7 日かかり、資料は 9 部です。\n";

  it("同じ行の指摘を桁の順に並べる", () => {
    const findings = runRules(buildDocument("a.md", source, ja), loadRules("ja"), {}, true, "blog/tech").findings;
    assert.deepEqual(
      findings.map((finding) => `${String(finding.line)}:${String(finding.column)}`),
      ["6:4", "6:6", "6:15", "6:17"],
    );
  });
});
