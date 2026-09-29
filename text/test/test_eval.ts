import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { evaluate, TARGET_HIT_RATE, type Point, type RuleReport } from "../packages/chaff/src/eval.ts";
import { renderEval } from "../packages/chaff/src/render/eval.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

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

describe("構造の rule", () => {
  const STRUCTURE_RULES = ["dangling-reference", "numbering-gap", "duplicate-definition"];
  const contract = "第1条（目的）\n第12条に定める。\n第2条（定義）\n本文";
  const measuredWith = (adapter: LanguageAdapter): string[] =>
    evaluate([buildDocument("c.txt", contract, adapter)], RULES, "business/contract", "ja")
      .map((report) => report.rule)
      .filter((id) => STRUCTURE_RULES.includes(id));

  it("構造を読める言語では測る", () => {
    assert.deepEqual(
      measuredWith(ja).sort((left, right) => left.localeCompare(right, "en")),
      [...STRUCTURE_RULES].sort((left, right) => left.localeCompare(right, "en")),
    );
  });

  it("構造を読めない言語では測らない（どの閾値でも 0 件を、校正済みに見せない）", () => {
    const blind: LanguageAdapter = {
      kind: ja.kind,
      id: ja.id,
      apiVersion: ja.apiVersion,
      capabilities: ja.capabilities,
      detect: ja.detect,
      segment: ja.segment,
      lexicons: ja.lexicons,
    };
    assert.deepEqual(measuredWith(blind), []);
  });
});

describe("語彙表の無い言語", () => {
  it("lint で動かない rule は掃引しない（宣言した語彙表のどれかが無い）", () => {
    const bare: LanguageAdapter = { ...ja, lexicons: Object.fromEntries(Object.entries(ja.lexicons).filter(([name]) => name !== "superlative-scope")) };
    const rule = RULES.filter((entry) => entry.id === "unqualified-superlative");
    assert.equal(evaluate([buildDocument("d.md", "# T\n\n最も速い。", ja)], rule, "business/report", "ja").length, 1);
    assert.equal(evaluate([buildDocument("d.md", "# T\n\n最も速い。", bare)], rule, "business/report", "ja").length, 0);
  });
});

describe("測定結果の言語", () => {
  const point = (limit: number, documents: number): Point => ({ limit, findings: documents * 2, documents, per10k: documents / 3 });
  const report = (rule: string, current: number, recommended: number | undefined, sweep: readonly Point[]): RuleReport => ({
    rule,
    name: rule,
    current,
    sweep,
    recommended,
    total: 10,
  });
  // 目標を満たす / 超えていて推奨がある / どの閾値でも満たさない、の 3 通りと、小さな corpus の注意書きをすべて通す。
  const REPORTS: readonly RuleReport[] = [
    report("fits", 10, 10, [point(5, 1), point(10, 0)]),
    report("too-strict", 5, 10, [point(5, 4), point(10, 0)]),
    report("hopeless", 5, undefined, [point(5, 6), point(10, 5)]),
  ];
  const JAPANESE = /[぀-ゟ゠-ヿ一-鿿]/u;

  it("英語では日本語を 1 文字も出さない", () => {
    const text = renderEval(REPORTS, 10, 10, "en");
    assert.doesNotMatch(text, JAPANESE);
    assert.match(text, /Measured 3 rules on 10 files as a corpus\./u);
    assert.match(text, /← current \/ recommended/u);
    assert.match(text, /Recommended: 10/u);
    assert.match(text, /No limit meets the target/u);
    assert.match(text, /the corpus has only 10 documents/u);
    assert.match(text, / {2}1 doc {2}\( 10\.0%\) {5}2 findings /u);
  });

  it("英語では 1 のときに単数で数える", () => {
    const text = renderEval([report("one", 5, 5, [{ limit: 5, findings: 1, documents: 0, per10k: 0 }])], 1, 1, "en");
    assert.match(text, /Measured 1 rule on 1 file as a corpus\./u);
    assert.match(text, /the corpus has only 1 document\./u);
    assert.match(text, / 1 finding {4}/u);
  });

  it("日本語では以前の文言のまま", () => {
    const text = renderEval(REPORTS, 10, 10, "ja");
    assert.match(text, /10 ファイルを corpus として 3 本の rule を測りました。/u);
    assert.match(text, /← 現在 \/ 推奨/u);
    assert.match(text, /推奨: 10/u);
    assert.match(text, /どの閾値でも目標を満たしません。/u);
    assert.match(text, /※ corpus が 10 文書しかありません。/u);
  });
});
