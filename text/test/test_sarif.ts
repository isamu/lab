import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { renderSarif, type Located } from "../packages/chaff/src/render/sarif.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import type { Finding } from "../packages/chaff/src/plugin.ts";

const ja = loadRules("ja");
const en = loadRules("en");

const finding = (rule: string, severity: Finding["severity"], line: number, column: number): Finding => ({
  rule,
  severity,
  line,
  column,
  quote: "引用",
  values: { count: 3, limit: 2, heading: "見出し", matched: "近年", word: "語", offset: 0 },
});

type Run = { readonly tool: { readonly driver: Record<string, unknown> }; readonly results: readonly Record<string, unknown>[] };

const isRun = (value: unknown): value is Run => typeof value === "object" && value !== null && "tool" in value && "results" in value;

/** 上げる側は JSON としてしか読まない。テストも同じ読みかたをする。 */
const runOf = (located: readonly Located[]): Run => {
  const raw: unknown = JSON.parse(renderSarif(located, "9.9.9"));
  const runs: unknown = typeof raw === "object" && raw !== null && "runs" in raw ? raw.runs : undefined;
  const first: unknown = Array.isArray(runs) ? runs[0] : undefined;
  if (!isRun(first)) throw new Error("SARIF の run が読めません");
  return first;
};

describe("SARIF 出力", () => {
  it("2.1.0 の器に入れる", () => {
    const text = renderSarif([{ path: "a.md", finding: finding("heading-echo", "warning", 3, 1), language: "ja", rules: ja }], "9.9.9");
    assert.match(text, /"version": "2\.1\.0"/u);
    assert.match(text, /sarif-2\.1\.0\.json/u);
    assert.match(text, /"name": "chaff"/u);
    assert.match(text, /"version": "9\.9\.9"/u);
  });

  it("info は note に写す。SARIF に info は無く、上げるときに弾かれる", () => {
    const located: Located[] = [
      { path: "a.md", finding: finding("heading-echo", "warning", 1, 1), language: "ja", rules: ja },
      { path: "a.md", finding: finding("rule-of-three", "info", 2, 1), language: "ja", rules: ja },
    ];
    assert.deepEqual(
      runOf(located).results.map((result) => result["level"]),
      ["warning", "note"],
    );
  });

  it("行と桁は 1 始まり。0 を上げると弾かれる", () => {
    const located: Located[] = [{ path: "a.md", finding: finding("heading-echo", "warning", 0, 0), language: "ja", rules: ja }];
    const region: unknown = runOf(located).results[0]?.["locations"];
    assert.match(JSON.stringify(region), /"startLine":1,"startColumn":1/u);
  });

  it("rule id に名前空間を切る。同じ PR の他のツールと衝突させない", () => {
    const located: Located[] = [{ path: "a.md", finding: finding("heading-echo", "warning", 1, 1), language: "ja", rules: ja }];
    assert.equal(runOf(located).results[0]?.["ruleId"], "chaff/heading-echo");
  });

  it("なぜ直すのかと、どう直すのかも一緒に上げる", () => {
    const located: Located[] = [{ path: "a.md", finding: finding("heading-echo", "warning", 1, 1), language: "ja", rules: ja }];
    const rules: unknown = runOf(located).tool.driver["rules"];
    assert.match(JSON.stringify(rules), /fullDescription/u);
    assert.match(JSON.stringify(rules), /help/u);
  });

  it("文言はファイルの言語で描く。1 つの repo に 2 言語が混ざる", () => {
    const located: Located[] = [
      { path: "ja.md", finding: finding("heading-echo", "warning", 1, 1), language: "ja", rules: ja },
      { path: "en.md", finding: finding("heading-echo", "warning", 1, 1), language: "en", rules: en },
    ];
    const messages = runOf(located).results.map((result) => JSON.stringify(result["message"]));
    assert.match(messages[0] ?? "", /見出し/u);
    assert.match(messages[1] ?? "", /repeats the heading/u);
  });

  it("同じ rule は 1 度しか書かない。SARIF は rule を 1 つしか持てない", () => {
    const located: Located[] = [
      { path: "a.md", finding: finding("heading-echo", "warning", 1, 1), language: "ja", rules: ja },
      { path: "b.md", finding: finding("heading-echo", "warning", 2, 1), language: "en", rules: en },
    ];
    const rules: unknown = runOf(located).tool.driver["rules"];
    assert.equal(Array.isArray(rules) ? rules.length : -1, 1);
  });

  it("指摘が無くても器は出す。上げる側が存在を確かめられるように", () => {
    assert.deepEqual(runOf([]).results, []);
  });
});
