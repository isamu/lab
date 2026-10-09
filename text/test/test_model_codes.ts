import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import {
  codesAfterLabels,
  codesInTitle,
  codesWithKey,
  isModelCodeShape,
  modelCodeKey,
  modelCodeVariants,
  type ModelCode,
} from "../packages/chaff/src/model-codes.ts";

// 型番の書き分け（name-variant の model-code）。型番・会社名・製品名はすべて架空、例文はすべて自作。

const surfaces = (codes: readonly ModelCode[]): string[] => codes.map((code) => code.surface);

const variantsIn = (text: string, anchors: readonly string[]): string[] =>
  modelCodeVariants(
    text,
    anchors.map((surface) => ({ offset: text.indexOf(surface), surface })),
  ).map(({ code, usual }) => `${code.surface}->${usual}`);

describe("name-variant model-code: the parts", () => {
  it("key: hyphens, spaces, case and width removed, letters and digits kept", () => {
    assert.equal(modelCodeKey("KM-SP300"), "kmsp300");
    assert.equal(modelCodeKey("km sp-300"), "kmsp300");
    assert.equal(modelCodeKey("ＫＭ－ＳＰ３００"), "kmsp300");
    assert.notEqual(modelCodeKey("KM-SP310"), modelCodeKey("KM-SP300"));
  });

  it("shape: capitals and digits, long enough, no small letters", () => {
    assert.ok(isModelCodeShape("KM-SP300"));
    assert.ok(isModelCodeShape("GM-40"));
    assert.ok(isModelCodeShape("ＫＭ－ＳＰ３００"));
    assert.ok(!isModelCodeShape("S3"), "too short to tell");
    assert.ok(!isModelCodeShape("iOS17"), "small letters: a name with a version, not a model number");
    assert.ok(!isModelCodeShape("v12"));
    assert.ok(!isModelCodeShape("ABCD"), "no digit");
    assert.ok(!isModelCodeShape("2027"), "no letter");
    assert.ok(!isModelCodeShape(""));
  });

  it("title: the codes in the heading, not a version or a word with small letters", () => {
    const title = "Orvane GM-40 Gear Motor for iOS17, v1.2";
    assert.deepEqual(surfaces(codesInTitle(title, 0, title.length)), ["GM-40"]);
    assert.deepEqual(surfaces(codesInTitle("JIS C 8714 準拠の電池", 0, 14)), [], "a standard number written with spaces is no one code");
    assert.deepEqual(surfaces(codesInTitle("", 0, 0)), []);
  });

  it("labels: the code right after the label, with or without a colon", () => {
    assert.deepEqual(surfaces(codesAfterLabels("型番：KM-SP300", ["型番"])), ["KM-SP300"]);
    assert.deepEqual(surfaces(codesAfterLabels("（型番 KM-SP300）", ["型番"])), ["KM-SP300"]);
    assert.deepEqual(surfaces(codesAfterLabels("Model number: KM-SP300", ["Model", "Model number"])), ["KM-SP300"]);
    assert.deepEqual(surfaces(codesAfterLabels("(model KM-SP300)", ["Model"])), ["KM-SP300"]);
    assert.deepEqual(surfaces(codesAfterLabels("Part No. AB-1203", ["Part No."])), ["AB-1203"]);
  });

  it("labels: nothing when what follows is not a code, or the label is inside a word", () => {
    assert.deepEqual(surfaces(codesAfterLabels("型番：未定", ["型番"])), []);
    assert.deepEqual(surfaces(codesAfterLabels("Remodel KM-SP300", ["Model"])), []);
    assert.deepEqual(surfaces(codesAfterLabels("Model: v1.2", ["Model"])), []);
    assert.deepEqual(surfaces(codesAfterLabels("Model: KM-SP300.pdf", ["Model"])), [], "a file name");
    assert.deepEqual(surfaces(codesAfterLabels("型番：KM-SP300", [])), []);
  });

  it("same key: hyphens, spaces, case and width, never other letters or digits", () => {
    const text = "KM-SP300, KM-SP-300, KMSP300, km-sp300, KM SP300, ＫＭ－ＳＰ３００, KM-SP310, KM-SP3000, KM-SP30";
    assert.deepEqual(surfaces(codesWithKey(text, "kmsp300")), ["KM-SP300", "KM-SP-300", "KMSP300", "km-sp300", "KM SP300", "ＫＭ－ＳＰ３００"]);
  });

  it("same key: not inside a longer code, a URL, a path or a file name", () => {
    const text = "KM-SP300-B, XKM-SP300, https://kumobi.example/p?model=KMSP300, /docs/km-sp300/, km-sp300.pdf, km-sp300_manual, #kmsp300";
    assert.deepEqual(surfaces(codesWithKey(text, "kmsp300")), []);
  });
});

describe("name-variant model-code: the decision", () => {
  it("the less used form of the document's model is reported", () => {
    assert.deepEqual(variantsIn("型番：KM-SP300。（型番 KM-SP300）。修理は KM-SP-300 で。", ["KM-SP300"]), ["KM-SP-300->KM-SP300"]);
    assert.deepEqual(variantsIn("Model KM-SP300. See KM-SP300. Ask for KMSP300 or km-sp300.", ["KM-SP300"]), ["KMSP300->KM-SP300", "km-sp300->KM-SP300"]);
  });

  it("a tie goes to the form in the title or after the label", () => {
    assert.deepEqual(variantsIn("GM-40 datasheet. The GM40 ships assembled.", ["GM-40"]), ["GM40->GM-40"]);
  });

  it("the usual form is the one written most, even when the label has the other", () => {
    assert.deepEqual(variantsIn("Model KM-SP-300. KM-SP300 and KM-SP300 again.", ["KM-SP-300"]), ["KM-SP-300->KM-SP300"]);
  });

  it("silent: a sibling model, a model written once, one form throughout", () => {
    assert.deepEqual(variantsIn("Model KM-SP300. Compare KM-SP310 and KM-SP-310.", ["KM-SP300"]), [], "the sibling is not the document's model");
    assert.deepEqual(variantsIn("Model KM-SP300 only.", ["KM-SP300"]), []);
    assert.deepEqual(variantsIn("Model KM-SP300. KM-SP300 again.", ["KM-SP300"]), []);
    assert.deepEqual(variantsIn("KM-SP300 and KM-SP-300 with no label.", []), [], "no anchor, no comparison");
  });

  it("silent: part numbers in a parts list differ in digits", () => {
    const text = "品番 AB-1203 のねじ、品番 AB-1204 の座金、品番 AB-1205 のナット。AB-1203 は 4 本。";
    assert.deepEqual(variantsIn(text, ["AB-1203", "AB-1204", "AB-1205"]), []);
  });

  it("silent: versions v1.2 and v1.20 are never codes", () => {
    const text = "Model V1.2, then Model V1.20. Version V12.0 follows.";
    assert.deepEqual(surfaces(codesAfterLabels(text, ["Model"])), []);
    assert.deepEqual(surfaces(codesInTitle(text, 0, text.length)), []);
  });

  it("a code anchored twice is compared once", () => {
    assert.deepEqual(variantsIn("Model KM-SP300. Model number KM-SP300. Ask for KMSP300.", ["KM-SP300", "KM-SP300"]), ["KMSP300->KM-SP300"]);
  });
});

const findings = (source: string, adapter = en): readonly string[] => namedRuleRun("name-variant", source, adapter, "a.md", "technical/spec").findings;

describe("name-variant model-code: through the rule", () => {
  before(async () => {
    await en.prepare?.({ pos: true });
    await ja.prepare?.({ pos: true });
  });

  it("ja: a model number after 型番 written with another hyphen", () => {
    const source =
      "# クモビ サウンドポッド S3 製品仕様書\n\n型番：KM-SP300\n\nサウンドポッド S3（型番 KM-SP300）は防水のスピーカーです。\n\n修理のときは、型番 KM-SP-300 をお伝えください。\n";
    assert.equal(findings(source, ja).length, 1);
    assert.match(findings(source, ja)[0] ?? "", /KM-SP-300/u);
  });

  it("en: a model number in the title written without its hyphen", () => {
    const source = "# Orvane GM-40 Gear Motor Datasheet\n\nThe GM-40 is a gear motor.\n\nOrder the GM40 with a bracket.\n";
    assert.equal(findings(source).length, 1);
    assert.match(findings(source)[0] ?? "", /GM40/u);
  });

  it("silent: a comparison table of sibling models", () => {
    const source = [
      "# Kumobi SoundPod S3",
      "",
      "Model number: KM-SP300",
      "",
      "| Model | Weight |",
      "| --- | --- |",
      "| KM-SP300 | 410 g |",
      "| KM-SP310 | 450 g |",
      "| KM-SP320 | 520 g |",
      "",
      "The KM-SP300 is the lightest.",
      "",
    ].join("\n");
    assert.deepEqual(findings(source), []);
  });

  it("silent: a standard number written joined and spaced, with no model label", () => {
    const source = "# Battery pack\n\nThe cells meet JIS C 8714. Tests follow JISC8714 and JIS C 8714.\n";
    assert.deepEqual(findings(source), []);
  });

  it("silent: a URL and a file name holding the model", () => {
    const source = "# Kumobi KM-SP300\n\nThe KM-SP300 manual is km-sp300.pdf at https://kumobi.example/kmsp300/.\n";
    assert.deepEqual(findings(source), []);
  });

  it("the title counts as one of the two: one other form in the body is reported", () => {
    const reported = findings("# Orvane GM-40 Gear Motor\n\nOrder the GM40 with a bracket.\n");
    assert.equal(reported.length, 1);
    assert.match(reported[0] ?? "", /"GM40" is written "GM-40"/u);
  });

  it("a tie between two body forms goes to the title's form", () => {
    const reported = findings("# Kumobi KM-SP300\n\nUse km-sp300 first. Use KMSP300 second.\n");
    assert.equal(reported.length, 2);
    assert.ok(reported.every((message) => message.includes('written "KM-SP300"')));
  });

  it("silent: a colour written as a hex code", () => {
    assert.deepEqual(findings("# Palette FF0000\n\nUse #ff0000 for danger.\n"), []);
  });
});
