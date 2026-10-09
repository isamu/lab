import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { labelOf, valueOf, type Reading } from "../packages/chaff/src/derived/battery-runtime.ts";
import { batteryWordsOf } from "../packages/chaff/src/detectors/capacity-runtime.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { loadLexicons as loadJaLexicons } from "../packages/lang-ja/src/lexicons.ts";
import { loadLexicons as loadEnLexicons } from "../packages/lang-en/src/lexicons.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// capacity-runtime-mismatch: a runtime above the battery capacity divided by the consumption. Self-written text.

const JA = batteryWordsOf(loadJaLexicons());
const EN = batteryWordsOf(loadEnLexicons());

const shown = (reading: Reading | undefined): string => {
  if (reading === undefined) return "none";
  const rough = reading.approximate ? " rough" : "";
  return `${reading.low}..${reading.high} ${reading.family} step ${reading.step}${rough}`;
};

describe("valueOf", () => {
  it("reads a capacity or a consumption in mAh, mA, Wh and W, scaled", () => {
    assert.equal(shown(valueOf("5000 mAh", "capacity", JA)?.reading), "5000..5000 charge step 1");
    assert.equal(shown(valueOf("5,000mAh", "capacity", JA)?.reading), "5000..5000 charge step 1");
    assert.equal(shown(valueOf("5 Ah", "capacity", EN)?.reading), "5000..5000 charge step 1000");
    assert.equal(shown(valueOf("0.5 A", "consumption", EN)?.reading), "500..500 current step 100");
    assert.equal(shown(valueOf("50 Wh", "capacity", EN)?.reading), "50..50 energy step 1");
    assert.equal(shown(valueOf("300〜500 mA", "consumption", JA)?.reading), "300..500 current step 1");
    assert.equal(shown(valueOf("約5000 mAh", "capacity", JA)?.reading), "5000..5000 charge step 1 rough");
  });

  it("reads a runtime in hours and minutes, a range at its ends, and the step of its last digit", () => {
    assert.equal(shown(valueOf("15時間", "runtime", JA)?.reading), "54000..54000 time step 3600");
    assert.equal(shown(valueOf("10時間30分", "runtime", JA)?.reading), "37800..37800 time step 60");
    assert.equal(shown(valueOf("8〜10時間", "runtime", JA)?.reading), "28800..36000 time step 3600");
    assert.equal(shown(valueOf("10.5 hours", "runtime", EN)?.reading), "37800..37800 time step 360");
    assert.equal(shown(valueOf("8-10 hours", "runtime", EN)?.reading), "28800..36000 time step 3600");
    assert.equal(shown(valueOf("up to 15 hours", "runtime", EN)?.reading), "54000..54000 time step 3600 rough");
    assert.equal(shown(valueOf("約15時間（音量50%時）", "runtime", JA)?.reading), "54000..54000 time step 3600 rough");
  });

  it("reads nothing from a bound, another unit, or more than a value", () => {
    assert.equal(valueOf("15時間以上", "runtime", JA), undefined);
    assert.equal(valueOf("at least 15 hours", "runtime", EN), undefined);
    assert.equal(valueOf("under 500 mA", "consumption", EN), undefined);
    assert.equal(valueOf("3.7 V 5000 mAh", "capacity", EN), undefined);
    assert.equal(valueOf("5000 mAh", "runtime", EN), undefined);
    assert.equal(valueOf("15 hours", "capacity", EN), undefined);
    assert.equal(valueOf("500 mA", "capacity", EN), undefined);
    assert.equal(valueOf("15時間程度で充電", "runtime", JA), undefined);
    assert.equal(valueOf("", "runtime", JA), undefined);
    assert.equal(valueOf("〜10時間", "runtime", JA), undefined);
  });

  it("marks a consumption written as a maximum", () => {
    assert.equal(valueOf("最大 1 A", "consumption", JA)?.peak, true);
    assert.equal(valueOf("1 A", "consumption", JA)?.peak, false);
  });
});

describe("labelOf", () => {
  it("reads the role, the condition, standby and the maximum", () => {
    assert.deepEqual(labelOf("消費電流（音量50%）", JA), { role: "consumption", standby: false, peak: false, condition: "音量50%" });
    assert.deepEqual(labelOf("待機電流", JA), { role: "consumption", standby: true, peak: false, condition: "" });
    assert.deepEqual(labelOf("最大消費電流", JA), { role: "consumption", standby: false, peak: true, condition: "" });
    assert.deepEqual(labelOf("Current draw (max)", EN), { role: "consumption", standby: false, peak: true, condition: "max" });
    assert.deepEqual(labelOf("Current draw (max volume)", EN), { role: "consumption", standby: false, peak: false, condition: "maxvolume" });
    assert.deepEqual(labelOf("Standby time", EN), { role: "runtime", standby: true, peak: false, condition: "" });
  });

  it("reads nothing from another item, or one naming two roles", () => {
    assert.equal(labelOf("充電端子", JA), undefined);
    assert.equal(labelOf("Weight", EN), undefined);
    assert.equal(labelOf("Capacity and runtime", EN), undefined);
  });
});

before(async () => {
  await ja.prepare?.({ pos: true });
  await en.prepare?.({ pos: true });
});

const found = (adapter: LanguageAdapter, source: string): string[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(adapter.id), {}, false, "technical/spec")
    .findings.filter((finding) => finding.rule === "capacity-runtime-mismatch")
    .map((finding) => `${finding.line} ${String(finding.values["runtime"])} ${String(finding.values["expected"])}`);

const table = (...rows: string[]): string => ["# 仕様", "", "| 項目 | 仕様 |", "| --- | --- |", ...rows.map((row) => `| ${row} |`), ""].join("\n");
const enTable = (...rows: string[]): string => ["# Specs", "", "| Item | Specification |", "| --- | --- |", ...rows.map((row) => `| ${row} |`), ""].join("\n");

describe("capacity-runtime-mismatch", () => {
  it("reports a runtime above the capacity divided by the consumption", () => {
    assert.deepEqual(found(ja, table("バッテリー容量 | 5000 mAh", "消費電流 | 500 mA", "連続使用時間 | 15時間")), ["7 15時間 10"]);
    assert.deepEqual(found(en, enTable("Battery capacity | 50 Wh", "Power consumption | 10 W", "Runtime | 8 hours")), ["7 8 hours 5"]);
    assert.deepEqual(found(en, enTable("Battery capacity | 5 Ah", "Current draw | 0.5 A", "Battery life | 15 h")), ["7 15 h 10"]);
  });

  it("stays silent on a runtime at or below the ideal, or within one written step above it", () => {
    assert.deepEqual(found(ja, table("バッテリー容量 | 5000 mAh", "消費電流 | 500 mA", "連続使用時間 | 10時間")), []);
    assert.deepEqual(found(ja, table("バッテリー容量 | 5000 mAh", "消費電流 | 500 mA", "連続使用時間 | 8時間")), []);
    assert.deepEqual(found(ja, table("バッテリー容量 | 5000 mAh", "消費電流 | 500 mA", "連続使用時間 | 11時間")), []);
    assert.deepEqual(found(ja, table("バッテリー容量 | 5000 mAh", "消費電流 | 500 mA", "連続使用時間 | 12時間")), ["7 12時間 10"]);
    assert.deepEqual(found(en, enTable("Battery capacity | 5000 mAh", "Current draw | 500 mA", "Runtime | 10.5 hours")), ["7 10.5 hours 10"]);
    assert.deepEqual(found(en, enTable("Battery capacity | 5000 mAh", "Current draw | 500 mA", "Runtime | 10.1 hours")), []);
  });

  it("doubles the margin for a rough value", () => {
    assert.deepEqual(found(ja, table("バッテリー容量 | 5000 mAh", "消費電流 | 500 mA", "連続使用時間 | 約12時間")), []);
    assert.deepEqual(found(ja, table("バッテリー容量 | 5000 mAh", "消費電流 | 500 mA", "連続使用時間 | 約13時間")), ["7 約13時間 10"]);
    assert.deepEqual(found(en, enTable("Battery capacity | about 5000 mAh", "Current draw | 500 mA", "Runtime | 12 hours")), []);
  });

  it("uses the typical consumption, never the maximum", () => {
    const typical = ["バッテリー容量 | 5000 mAh", "消費電流（標準） | 500 mA", "消費電流（最大） | 1000 mA"];
    assert.deepEqual(found(ja, table(...typical, "連続使用時間 | 10時間")), []);
    assert.deepEqual(found(ja, table(...typical, "連続使用時間 | 15時間")), ["8 15時間 10"]);
    assert.deepEqual(found(ja, table("バッテリー容量 | 5000 mAh", "最大消費電流 | 1000 mA", "連続使用時間 | 8時間")), []);
    assert.deepEqual(found(en, enTable("Battery capacity | 5000 mAh", "Current draw | up to 1 A", "Runtime | 8 hours")), []);
  });

  it("pairs a standby time only with a standby consumption", () => {
    const device = ["バッテリー容量 | 5000 mAh", "消費電流 | 500 mA", "待機電流 | 0.5 mA", "連続使用時間 | 10時間"];
    assert.deepEqual(found(ja, table(...device, "待受時間 | 8000時間")), []);
    assert.deepEqual(found(ja, table(...device, "待受時間 | 12000時間")), ["9 12000時間 10000"]);
    assert.deepEqual(found(en, enTable("Battery capacity | 5000 mAh", "Current draw | 500 mA", "Standby time | 300 hours")), []);
  });

  it("pairs the consumption and the runtime of the same mode in one table", () => {
    const modes = ["Battery capacity | 5000 mAh", "Current draw (50% volume) | 500 mA", "Current draw (full volume) | 1000 mA"];
    assert.deepEqual(found(en, enTable(...modes, "Playback time (50% volume) | 10 hours", "Playback time (full volume) | 5 hours")), []);
    assert.deepEqual(found(en, enTable(...modes, "Playback time (50% volume) | 10 hours", "Playback time (full volume) | 8 hours")), ["9 8 hours 5"]);
    assert.deepEqual(found(en, enTable(...modes, "Playback time (low volume) | 15 hours")), []);
  });

  it("does not pick between two runtimes for one consumption", () => {
    assert.deepEqual(found(ja, table("バッテリー容量 | 5000 mAh", "消費電流 | 500 mA", "連続再生時間 | 15時間", "連続通話時間 | 20時間")), []);
  });

  it("compares a range at the end that favours the writer", () => {
    assert.deepEqual(found(ja, table("バッテリー容量 | 5000 mAh", "消費電流 | 500 mA", "連続使用時間 | 8〜12時間")), []);
    assert.deepEqual(found(ja, table("バッテリー容量 | 5000 mAh", "消費電流 | 500 mA", "連続使用時間 | 12〜15時間")), ["7 12〜15時間 10"]);
    assert.deepEqual(found(ja, table("バッテリー容量 | 5000 mAh", "消費電流 | 300〜500 mA", "連続使用時間 | 15時間")), []);
  });

  it("does not divide mAh by W, or read values in different sections or in prose", () => {
    assert.deepEqual(found(en, enTable("Battery capacity | 5000 mAh", "Power consumption | 2 W", "Runtime | 15 hours")), []);
    const split = ["# 仕様", "", "## 電池", "", "容量：5000 mAh", "", "## 性能", "", "消費電流：500 mA", "", "連続使用時間：15時間", ""].join("\n");
    assert.deepEqual(found(ja, split), []);
    assert.deepEqual(found(ja, "# 仕様\n\n容量 5000 mAh の電池で、消費電流は 500 mA、連続使用時間は15時間です。\n"), []);
  });

  it("reads labelled lines of one section", () => {
    const lines = ["# 仕様", "", "- 容量：5000 mAh", "- 消費電流：500 mA", "- 連続使用時間：15時間", ""].join("\n");
    assert.deepEqual(found(ja, lines), ["5 15時間 10"]);
    const english = ["# Specs", "", "Capacity: 50 Wh", "", "Power consumption: 10 W", "", "Battery life: up to 5 hours", ""].join("\n");
    assert.deepEqual(found(en, english), []);
  });

  it("reads a wider table one column at a time", () => {
    const models = [
      "# Models",
      "",
      "| Item | S3 | S5 |",
      "| --- | --- | --- |",
      "| Battery capacity | 5000 mAh | 8000 mAh |",
      "| Current draw | 500 mA | 500 mA |",
    ];
    assert.deepEqual(found(en, [...models, "| Runtime | 10 hours | 16 hours |", ""].join("\n")), []);
    assert.deepEqual(found(en, [...models, "| Runtime | 16 hours | 16 hours |", ""].join("\n")), ["7 16 hours 10"]);
    const peak = ["# 消費", "", "| 項目 | 標準 | 最大 |", "| --- | --- | --- |", "| 容量 | 5000 mAh | 5000 mAh |", "| 消費電流 | 500 mA | 1000 mA |"];
    assert.deepEqual(found(ja, [...peak, "| 連続使用時間 | 10時間 | 8時間 |", ""].join("\n")), []);
    const typ = [
      "# Draw",
      "",
      "| Item | Typ. | Max. |",
      "| --- | --- | --- |",
      "| Battery capacity | 5000 mAh | 5000 mAh |",
      "| Current draw | 500 mA | 1000 mA |",
    ];
    assert.deepEqual(found(en, [...typ, "| Runtime | 10 hours | 8 hours |", ""].join("\n")), []);
  });

  it("reads a standby condition only when the bracket says only that", () => {
    const standby = ["Battery capacity | 5000 mAh", "Current draw | 500 mA", "Current draw (idle mode) | 0.5 mA"];
    assert.deepEqual(found(en, enTable(...standby, "Standby time | 12000 hours")), ["8 12000 hours 10000"]);
    const timer = ["Battery capacity | 5000 mAh", "Standby current | 0.5 mA", "Playback time (sleep timer off) | 15000 hours"];
    assert.deepEqual(found(en, enTable(...timer)), []);
    const ja2 = ["バッテリー容量 | 5000 mAh", "消費電流（待機時） | 0.5 mA", "連続待受時間 | 12000時間"];
    assert.deepEqual(found(ja, table(...ja2)), ["7 12000時間 10000"]);
  });

  it("reads a long labelled line", () => {
    const lines = ["# Specs", "", "Battery capacity: 5000 mAh", "", "Current draw: 500 mA", "", "Playback time (Bluetooth, noise canceling on): 15 hours", ""];
    assert.deepEqual(found(en, lines.join("\n")), ["7 15 hours 10"]);
  });
});
