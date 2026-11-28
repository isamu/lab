import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { applySuppressions, knownRulesOf, readSuppressions, type KnownRules } from "../packages/chaff/src/stet.ts";
import { readStetBody } from "../packages/chaff/src/stet-body.ts";
import { renderSuppressions } from "../packages/chaff/src/render/suppressions.ts";
import type { Finding } from "../packages/chaff/src/plugin.ts";
import { runCli } from "./cli-run.ts";

const A = "bold-density";
const B = "heading-echo";
const TERM = "preferred-term";

const at = (rule: string, line: number, matched?: string): Finding => ({
  rule,
  severity: "warning",
  line,
  column: 1,
  quote: "",
  values: matched === undefined ? {} : { matched },
});

/** One finding of each rule on every line of the text: the lines each rule keeps after the stets. */
const keptLines = (text: string, rules: readonly string[] = [A]): Record<string, number[]> => {
  const lines = text.split("\n").length;
  const findings = rules.flatMap((rule) => Array.from({ length: lines }, (_, index) => at(rule, index + 1)));
  const { kept } = applySuppressions(text, findings, [{ start: 0, end: text.length }]);
  return Object.fromEntries(rules.map((rule) => [rule, kept.filter((finding) => finding.rule === rule).map((finding) => finding.line)]));
};

const KNOWN: KnownRules = new Map([
  [A, { showsMatched: false }],
  [B, { showsMatched: false }],
  [TERM, { showsMatched: true }],
]);

describe("stet-begin … stet-end", () => {
  it("silences the named rules from the begin line to the end line, and nothing outside", () => {
    const text = ["前。", `<!-- stet-begin: ${A}, ${B} — 引用 -->`, "一。", "二。", "<!-- stet-end -->", "後。"].join("\n");
    assert.deepEqual(keptLines(text, [A, B]), { [A]: [1, 6], [B]: [1, 6] });
  });

  it("leaves a rule it does not name alone", () => {
    const text = [`<!-- stet-begin: ${A} — 引用 -->`, "一。", "<!-- stet-end -->"].join("\n");
    assert.deepEqual(keptLines(text, [A, B]), { [A]: [], [B]: [1, 2, 3] });
  });

  it("nests: each end closes the nearest open begin", () => {
    const text = [`<!-- stet-begin: ${A} — 外 -->`, `<!-- stet-begin: ${B} — 内 -->`, "一。", "<!-- stet-end -->", "二。", "<!-- stet-end -->", "後。"].join(
      "\n",
    );
    assert.deepEqual(keptLines(text, [A, B]), { [A]: [7], [B]: [1, 5, 6, 7] });
  });

  it("an unclosed begin silences nothing and is a problem", () => {
    const text = [`<!-- stet-begin: ${A} — 引用 -->`, "一。"].join("\n");
    assert.deepEqual(keptLines(text), { [A]: [1, 2] });
    assert.deepEqual(readSuppressions(text).problems, [{ kind: "unclosed", line: 1 }]);
  });

  it("an end with no begin is a problem", () => {
    assert.deepEqual(readSuppressions("一。\n<!-- stet-end -->").problems, [{ kind: "stray-end", line: 2 }]);
  });

  it("a range with no reason is counted as reasonless, like any stet", () => {
    const applied = applySuppressions(`<!-- stet-begin: ${A} -->\n一。\n<!-- stet-end -->`, [], []);
    assert.equal(applied.unusedReasonless.length, 1);
    assert.deepEqual(
      applied.ranges.map((range) => [range.line, range.blockEnd, range.reason]),
      [[1, 3, undefined]],
    );
  });

  it("thousands of ranges, each around its own paragraph", { timeout: 60_000 }, () => {
    const text = Array.from({ length: 2000 }, (_, index) => `<!-- stet-begin: ${A} — r -->\n段落 ${String(index)}。\n<!-- stet-end -->`).join("\n\n");
    const blanks = text.split("\n").flatMap((line, index) => (line === "" ? [index + 1] : []));
    assert.deepEqual(keptLines(text), { [A]: blanks });
  });

  it("has no all-rules form: a begin naming no rule is a problem", () => {
    assert.deepEqual(readSuppressions("<!-- stet-begin: — 引用 -->\n<!-- stet-end -->").problems, [{ kind: "no-rules", line: 1 }]);
  });
});

describe("stet problems in rule names", () => {
  it("an id chaff does not know, given the known rules", () => {
    assert.deepEqual(readSuppressions(`<!-- stet: ${A}, bold-densty — r -->`, KNOWN).problems, [{ kind: "unknown-rule", line: 1, rule: "bold-densty" }]);
  });

  it("an entry that is not a rule name at all, even without the known rules", () => {
    assert.deepEqual(readSuppressions("<!-- stet: Bold Density — r -->").problems, [{ kind: "unknown-rule", line: 1, rule: "Bold Density" }]);
  });

  it("nothing for a known rule", () => {
    assert.deepEqual(readSuppressions(`<!-- stet: ${A} — r -->`, KNOWN).problems, []);
  });
});

describe('rule["text"]: a stet for one matched word', () => {
  it("reads the rule, the text and the reason, a comma or a dash inside the text included", () => {
    assert.deepEqual(readStetBody(` ${TERM}["サーバー"], ${A} — 製品名 `), {
      rules: [TERM, A],
      matching: { [TERM]: ["サーバー"] },
      reason: "製品名",
      malformed: [],
    });
    assert.deepEqual(readStetBody(` ${TERM}["a, b — c"] — 理由 `).matching, { [TERM]: ["a, b — c"] });
  });

  it("silences only the findings of that rule whose matched text is that string", () => {
    const text = [`<!-- stet: ${TERM}["サーバ"] — 製品名 -->`, "サーバとメイルの話。"].join("\n");
    const { kept } = applySuppressions(text, [at(TERM, 2, "サーバ"), at(TERM, 2, "メイル"), at(A, 2)], []);
    assert.deepEqual(
      kept.map((finding) => [finding.rule, finding.values["matched"]]),
      [
        [TERM, "メイル"],
        [A, undefined],
      ],
    );
  });

  it("works with every scope, a range included", () => {
    const text = [`<!-- stet-begin: ${TERM}["サーバ"] — 引用 -->`, "サーバ。", "<!-- stet-end -->", "サーバ。"].join("\n");
    const { kept } = applySuppressions(text, [at(TERM, 2, "サーバ"), at(TERM, 4, "サーバ")], []);
    assert.deepEqual(
      kept.map((finding) => finding.line),
      [4],
    );
  });

  it("a bare name in the same stet lifts the limit", () => {
    assert.deepEqual(readStetBody(`${TERM}["x"], ${TERM} — r`).matching, {});
  });

  it("is a problem on a rule whose findings carry no matched text", () => {
    assert.deepEqual(readSuppressions(`<!-- stet: ${A}["x"] — r -->`, KNOWN).problems, [{ kind: "no-matched-text", line: 1, rule: A }]);
  });

  it("a text left open is not a rule name", () => {
    assert.deepEqual(readStetBody(`${TERM}["x — r`).malformed, [`${TERM}["x`]);
  });

  it("knows which rules carry the matched text from their messages", () => {
    const known = knownRulesOf([
      { id: TERM, message: { ja: "「{matched}」", en: "{matched}" }, messages: {} },
      { id: A, message: { ja: "多い", en: "many" }, messages: { other: { ja: "{matched}", en: "{matched}" } } },
      { id: B, message: { ja: "x", en: "x" }, messages: {} },
    ]);
    assert.deepEqual(
      [...known].map(([id, rule]) => [id, rule.showsMatched]),
      [
        [TERM, true],
        [A, true],
        [B, false],
      ],
    );
  });
});

describe("chaff suppressions shows ranges and problems", () => {
  it("lists each range with its lines, rules and reason, and each problem with its line", () => {
    const applied = applySuppressions([`<!-- stet-begin: ${A} — 引用 -->`, "一。", "<!-- stet-end -->", "<!-- stet-end -->"].join("\n"), [at(A, 2)], [], KNOWN);
    const file = {
      path: "a.md",
      suppressed: applied.suppressed,
      reasonless: applied.unusedReasonless,
      notRun: [],
      ranges: applied.ranges,
      problems: applied.problems,
    };
    const en = renderSuppressions([file], "en");
    assert.match(en, /Range stets \(stet-begin … stet-end\):\n {6}a\.md:1-3 {3}bold-density {3}引用/u);
    assert.match(en, /Stets that do not work or are written wrong: 1\n {6}a\.md:4 {3}stet-end with no stet-begin to close/u);
    const ja = renderSuppressions([file], "ja");
    assert.match(ja, /範囲の stet/u);
    assert.match(ja, /a\.md:4 {3}対応する stet-begin の無い stet-end です/u);
  });

  it("end to end, from chaff.yaml's prefer list", async () => {
    const doc = ["# 手引き", "", `<!-- stet: ${TERM}["サーバ"] — 製品名 -->`, "サーバに接続する。", "", "<!-- stet: no-such-rule — r -->", "本文。", ""].join(
      "\n",
    );
    const run = await runCli({ "chaff.yaml": "prefer:\n  サーバ: サーバー\n", "a.md": doc }, ["suppressions", "."], "en_US.UTF-8");
    assert.match(run.out, /Silenced findings: 1/u);
    assert.match(run.out, /a\.md:6 {3}there is no rule named "no-such-rule"/u);
  });
});
