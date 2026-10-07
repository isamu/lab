import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { prepare } from "../packages/lang-ja/src/pos.ts";
import { labelsIn, labelVariants } from "../packages/chaff/src/ui-labels.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// 同じ画面の札を二通りに書いた所（ui-label-variant）。例文は自作。

const RULE = "ui-label-variant";

const found = (source: string, adapter: LanguageAdapter, genre = "docs/manual"): string[] =>
  runRules(buildDocument("manual.md", source, adapter), loadRules(adapter.id), {}, false, genre)
    .findings.filter((finding) => finding.rule === RULE)
    .map((finding) => `${String(finding.line)} ${String(finding.values["written"])}>${String(finding.values["usual"])}`);

const doc = (...lines: string[]): string => ["# Restore", "", ...lines, ""].join("\n");

before(async () => prepare());

describe("ui-label-variant", () => {
  it("ja: 「を」の有る無しだけが違う札の、少ないほうを指す", () => {
    const source = doc("［復元を開始］を押します。", "", "もう一度［復元を開始］を押します。", "", "前のバックアップで［復元開始］を押します。");
    assert.deepEqual(found(source, ja), ["7 復元開始>復元を開始"]);
    assert.deepEqual(found(source.replace("［復元開始］", "［復元を開始］"), ja), []);
  });

  it("en: a label differing only in case, the fewer form", () => {
    const source = doc("Click **Start Restore**.", "", "Click **Start Restore** again.", "", "Then click **Start restore**.");
    assert.deepEqual(found(source, en), ["7 Start restore>Start Restore"]);
    assert.deepEqual(found(source.replace("**Start restore**", "**Start Restore**"), en), []);
  });

  it("on a tie, points at the later form", () => {
    assert.deepEqual(found(doc("Click **Save Settings**.", "", "Then click **Save settings**."), en), ["5 Save settings>Save Settings"]);
  });

  it("reads labels in __bold__ too", () => {
    assert.deepEqual(found(doc("Click __Start Restore__.", "", "Click __Start Restore__ again.", "", "Then click __Start restore__."), en), [
      "7 Start restore>Start Restore",
    ]);
  });

  it("does not read emphasis capitalised at a sentence's start, or a particle inside a word, as two forms", () => {
    assert.deepEqual(found(doc("**Note** that it runs.", "", "**Note** the time.", "", "Read the **note** below."), en), []);
    assert.deepEqual(found(doc("［その他］を選びます。", "", "もう一度［その他］を選びます。", "", "［そ他］を選びます。"), ja), []);
    assert.deepEqual(found(doc("［設定の保存］を押します。", "", "［設定の保存］を押します。", "", "［設定保存］を押します。"), ja), ["7 設定保存>設定の保存"]);
  });

  it("does not compare different labels, labels in code, or other genres", () => {
    assert.deepEqual(found(doc("Click **Save**.", "", "Then click **Save As**."), en), []);
    assert.deepEqual(found(doc("Click **Start Restore**.", "", "Run `**Start restore**`."), en), []);
    assert.deepEqual(found(doc("Click **Start Restore**.", "", "Then click **Start restore**."), en, "business/email"), []);
  });
});

describe("labelsIn and labelVariants", () => {
  it("reads bold and full-width bracketed labels holding a letter", () => {
    assert.deepEqual(
      labelsIn("**Save** and ［保存］ and **123**", "**Save** and ［保存］ and **123**").map((label) => label.surface),
      ["Save", "保存"],
    );
    assert.deepEqual(labelsIn("", ""), []);
  });
  it("needs two forms of one key", () => {
    const label = (surface: string, offset: number): { surface: string; offset: number } => ({ surface, offset });
    assert.deepEqual(labelVariants([label("Save", 0), label("Save", 10)]), []);
    assert.deepEqual(labelVariants([label("復元を開始", 0), label("復元開始", 10)]), []);
    assert.deepEqual(labelVariants([label("復元を開始", 0), label("復元開始", 10)], ["を"]), [{ label: label("復元開始", 10), usual: "復元を開始" }]);
    assert.deepEqual(labelVariants([]), []);
  });
});
