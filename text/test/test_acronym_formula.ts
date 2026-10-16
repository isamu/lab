import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { reportedAcronyms } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

// 化学式（大文字に下付きの数字か数字が続く）は略語ではない。例文はすべて自作。

describe("undefined-acronym: 化学式は略語ではない", () => {
  it("下付きの数字・数字・小文字が続く大文字は読まない", () => {
    assert.deepEqual(reportedAcronyms(ja, "新しい炉はCO₂削減に効きます。排水のSO₄も減ります。\n"), []);
    assert.deepEqual(reportedAcronyms(ja, "新しい炉はCO2削減に効きます。NOxも減ります。\n"), []);
    assert.deepEqual(reportedAcronyms(en, "The new kiln cuts CO₂ and SO₄ output.\n"), []);
  });

  it("下付きの数字が続かない略語は、化学式の隣にあっても指す", () => {
    assert.deepEqual(reportedAcronyms(ja, "新しい炉はCO₂削減とBCPに効きます。\n"), ["BCP"]);
    assert.deepEqual(reportedAcronyms(ja, "CO削減に効きます。\n"), ["CO"]);
    assert.deepEqual(reportedAcronyms(en, "The new kiln cuts CO₂ and helps our BCP.\n"), ["BCP"]);
  });
});
