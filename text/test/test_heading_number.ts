import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { opensSubsection } from "../packages/chaff/src/detectors/heading-number.ts";

// A heading whose number makes the next heading its subsection (3. then 3.1). Every example is self-written.

describe("opensSubsection", () => {
  it("reads a dotted number one level down as a subsection", () => {
    assert.equal(opensSubsection("3. 最近の動向", "3.1 問題のある使い方"), true);
    assert.equal(opensSubsection("4.2 研究", "4.2.1 意識調査"), true);
    assert.equal(opensSubsection("３．動向", "３．１　事例"), true);
    assert.equal(opensSubsection("2 Methods", "2.1 Data"), true);
  });

  it("reads the first bracketed item under a numbered heading as a subsection", () => {
    assert.equal(opensSubsection("4. 査読の見直し", "(1) 時間の問題"), true);
    assert.equal(opensSubsection("4. 査読の見直し", "（１）時間の問題"), true);
  });

  it("does not read a sibling, a deeper level skipped, another section or an unnumbered heading as a subsection", () => {
    assert.equal(opensSubsection("3. 動向", "4. おわりに"), false);
    assert.equal(opensSubsection("3.1 事例", "3.2 事例"), false);
    assert.equal(opensSubsection("3. 動向", "3.1.1 事例"), false);
    assert.equal(opensSubsection("3. 動向", "31. 事例"), false);
    assert.equal(opensSubsection("3. 動向", "(2) 事例"), false);
    assert.equal(opensSubsection("動向", "(1) 事例"), false);
    assert.equal(opensSubsection("2024年の動向", "(1) 事例"), false);
    assert.equal(opensSubsection("", ""), false);
  });
});
