import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { coefficientOfVariation } from "../packages/chaff/src/detectors/structure.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";

const RULES = loadRules("ja");

const idsFor = (source: string, genre = "blog/tech"): string[] =>
  runRules(buildDocument("t.md", source, ja), RULES, {}, true, genre).findings.map((finding) => finding.rule);

const SENTENCE = "あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめも。";

describe("変動係数", () => {
  it("揃っていれば 0、ばらつくほど大きい", () => {
    assert.equal(coefficientOfVariation([10, 10, 10]), 0);
    assert.ok((coefficientOfVariation([1, 10, 100]) ?? 0) > 1);
  });

  it("2 つ未満と平均 0 では測らない", () => {
    // 1 つしか無いものを「揃っている」と言わない。
    assert.equal(coefficientOfVariation([5]), undefined);
    assert.equal(coefficientOfVariation([]), undefined);
    assert.equal(coefficientOfVariation([0, 0]), undefined);
  });
});

describe("max-paragraph-length", () => {
  it("invalid: 1 段落に 7 文", () => {
    const long = Array.from({ length: 7 }, (_, index) => `これは${String(index)}番目の文です。`).join("");
    assert.ok(idsFor(`# 見出し\n\n${long}`).includes("max-paragraph-length"));
  });

  it("valid: 割ってあれば指摘しない", () => {
    const split = Array.from({ length: 7 }, (_, index) => `これは${String(index)}番目の文です。`).join("\n\n");
    assert.ok(!idsFor(`# 見出し\n\n${split}`).includes("max-paragraph-length"));
  });

  it("箇条書きの項目は段落として数えない", () => {
    const list = Array.from({ length: 7 }, (_, index) => `- 項目${String(index)}です。`).join("\n");
    assert.ok(!idsFor(`# 見出し\n\n${list}`).includes("max-paragraph-length"));
  });
});

describe("paragraph-length-variance", () => {
  it("invalid: 同じ長さの段落が並ぶ", () => {
    assert.ok(idsFor(`# 見出し\n\n${Array(6).fill(SENTENCE).join("\n\n")}`).includes("paragraph-length-variance"));
  });

  it("valid: 長さが揺れていれば指摘しない", () => {
    const varied = ["短い。", SENTENCE, `${SENTENCE}${SENTENCE}${SENTENCE}`, "ごく短い。", `${SENTENCE}${SENTENCE}`].join("\n\n");
    assert.ok(!idsFor(`# 見出し\n\n${varied}`).includes("paragraph-length-variance"));
  });
});

describe("section-length-uniformity", () => {
  it("invalid: 節の長さが揃っている", () => {
    const sections = Array.from({ length: 5 }, (_, index) => `## 節${String(index)}\n\n${SENTENCE}`).join("\n\n");
    assert.ok(idsFor(`# 表題\n\n${sections}`).includes("section-length-uniformity"));
  });

  it("valid: 節の量が違えば指摘しない", () => {
    const sections = ["## 一\n\n短い。", `## 二\n\n${SENTENCE}${SENTENCE}${SENTENCE}`, `## 三\n\n${SENTENCE}`].join("\n\n");
    assert.ok(!idsFor(`# 表題\n\n${sections}`).includes("section-length-uniformity"));
  });
});

describe("rule-of-three", () => {
  it("invalid: 箇条書きが全部 3 項目", () => {
    const blocks = Array.from({ length: 4 }, (_, index) => `項目${String(index)}の説明です。\n\n- あ\n- い\n- う`).join("\n\n");
    assert.ok(idsFor(`# 見出し\n\n${blocks}`).includes("rule-of-three"));
  });

  it("valid: 数が揃っていなければ指摘しない", () => {
    const blocks = [
      "説明です。\n\n- あ\n- い",
      "説明です。\n\n- あ\n- い\n- う\n- え",
      "説明です。\n\n- あ\n- い\n- う",
      "説明です。\n\n- あ\n- い\n- う\n- え\n- お",
    ].join("\n\n");
    assert.ok(!idsFor(`# 見出し\n\n${blocks}`).includes("rule-of-three"));
  });

  it("箇条書きが 3 個未満なら測らない。割合が暴れるため", () => {
    assert.ok(!idsFor("# 見出し\n\n説明です。\n\n- あ\n- い\n- う").includes("rule-of-three"));
  });
});

describe("preamble-length", () => {
  it("invalid: 中見出しまでに 3 段落", () => {
    assert.ok(idsFor("# 表題\n\n前置き一。\n\n前置き二。\n\n前置き三。\n\n## 本題\n\n中身です。", "business/report").includes("preamble-length"));
  });

  it("valid: すぐ本題に入れば指摘しない", () => {
    assert.ok(!idsFor("# 表題\n\n一言だけ。\n\n## 本題\n\n中身です。", "business/report").includes("preamble-length"));
  });

  it("中見出しが無い文書では何も言わない。全文が前置きになってしまうため", () => {
    assert.ok(!idsFor("# 表題\n\n一。\n\n二。\n\n三。\n\n四。", "business/report").includes("preamble-length"));
  });
});
