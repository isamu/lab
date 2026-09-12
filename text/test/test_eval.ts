import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { evaluate, TARGET_HIT_RATE } from "../packages/chaff/src/eval.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";

const RULES = loadRules("ja");
const docs = (sources: readonly string[]) => sources.map((source, index) => buildDocument(`d${index}.md`, source, ja));
const reportFor = (id: string, sources: readonly string[]) =>
  evaluate(
    docs(sources),
    RULES.filter((rule) => rule.id === id),
    "blog/tech",
    "ja",
  )[0];

/** bold-density は密度で測るので、節の長さも与える。短すぎる節は対象外。 */
const bold = (count: number, chars = 300): string => {
  const runs = Array.from({ length: count }, (__x, index) => `**${index}**`).join("");
  return `## 節\n\n${runs}${"あ".repeat(chars)}。`;
};
const clean = `## 節\n\n${"あ".repeat(400)}。これも短い。`;

describe("閾値の掃引", () => {
  it("閾値を上げるほど指摘が減る", () => {
    const report = reportFor("bold-density", [bold(6)]);
    const counts = report?.sweep.map((point) => point.findings) ?? [];
    assert.ok(counts.length > 1);
    assert.deepEqual(
      [...counts].sort((a, b) => b - a),
      counts,
      `単調に減っていない: ${counts.join(",")}`,
    );
  });

  it("rule 自身の段を必ず含む", () => {
    // 掃引の点が rule の段とずれていると、「いまの設定」を表に示せない。
    const limits = reportFor("bold-density", [clean])?.sweep.map((point) => point.limit) ?? [];
    [10, 20, 40].forEach((level) => assert.ok(limits.includes(level), `${level} が掃引に無い: ${limits.join(",")}`));
  });

  it("文字数あたりの密度も出す", () => {
    // 文書数の割合は corpus が小さいと「0 か全部」になる。密度は大きさに依らない。
    const point = reportFor("bold-density", [bold(6)])?.sweep[0];
    assert.ok((point?.per10k ?? 0) > 0);
  });
});

describe("推奨の出しかた", () => {
  it("目標を満たす中でいちばん厳しい閾値を選ぶ", () => {
    // 指摘の出ない文書ばかりなら、いちばん厳しい値を勧めてよい。
    const report = reportFor("bold-density", [clean, clean, clean]);
    assert.equal(report?.recommended, Math.min(...(report?.sweep.map((point) => point.limit) ?? [])));
  });

  it("どの閾値でも目標を満たさなければ推奨を出さない", () => {
    // 嘘の推奨を出すより、rule 自体を疑わせるほうがよい。
    const report = reportFor("bold-density", [bold(60, 250)]);
    assert.equal(report?.recommended, undefined);
  });

  it("向きが逆の rule では、大きいほうが厳しい", () => {
    // sentence-rhythm は strict 35 / relaxed 20。値が大きいほど厳しい。
    const rhythm = RULES.find((rule) => rule.id === "sentence-rhythm");
    assert.ok(rhythm !== undefined);
    assert.ok((rhythm.levels.strict ?? 0) > (rhythm.levels.relaxed ?? 0), "前提が崩れている");
    const report = evaluate(docs([clean]), [rhythm], "blog/tech", "ja")[0];
    assert.equal(report?.recommended, Math.max(...(report?.sweep.map((point) => point.limit) ?? [])));
  });
});

describe("対象の絞り込み", () => {
  it("意味を読む検査は測らない", () => {
    // L4 に数値の閾値は無い。掃引しても意味がない。
    const l4 = RULES.filter((rule) => rule.layer === "L4").map((rule) => rule.id);
    const measured = evaluate(docs([clean]), RULES, "business/proposal", "ja").map((report) => report.rule);
    l4.forEach((id) => assert.ok(!measured.includes(id), `${id} を測っている`));
  });

  it("ジャンルが合わない rule は測らない", () => {
    const measured = evaluate(docs([clean]), RULES, "business/report", "ja").map((report) => report.rule);
    assert.ok(!measured.includes("padded-intro"), "blog 専用の rule を business で測っている");
  });

  it("目標は 5%", () => {
    assert.equal(TARGET_HIT_RATE, 0.05);
  });
});
