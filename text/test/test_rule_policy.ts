import { existsSync } from "node:fs";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BENCH_MIN_PRECISION, MIN_DOCUMENTS, NORMAL_MAX_SHARE, OFF_MIN_SHARE, disagreements, standingOf, type Standing } from "../scripts/rule-policy.ts";
import {
  aiBenchRows,
  benchPrecision,
  benchRowOf,
  groupShares,
  isMeasurement,
  overallShares,
  withoutBaseline,
  type RuleMeasure,
} from "../scripts/rules-measure-score.ts";
import { measuredOffsOf, withInfoAtNormal, withMeasuredOffs, withStatus } from "../scripts/rules-apply.ts";
import { MEASURE_FILE, policyProblems, readMeasurement } from "../scripts/rules-measure-files.ts";
import { parseGenres } from "../packages/chaff/src/genre-parse.ts";
import type { RuleDefinition } from "../packages/chaff/src/plugin.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";

// どの rule を既定で動かすかは、yarn rules:measure の数で決める（spec §21.1）。

const RULE: Pick<RuleDefinition, "id" | "layer" | "status"> = { id: "some-rule", layer: "L2", status: "experimental" };
const NONE: ReadonlySet<string> = new Set();

/** A group of `documents` documents the rule reports on `fired` of. */
const group = (fired: number, documents = 20) => ({ documents, fired });

const measured = (groups: RuleMeasure["groups"], extra: Partial<RuleMeasure> = {}): RuleMeasure => ({ groups, ...extra });

describe("standingOf", () => {
  it("人の文書の一割以下にしか出ず、bench の指摘がどれも正しければ、自分の段で動く", () => {
    assert.deepEqual(standingOf(RULE, measured({ business: group(2), blog: group(0) }), NONE), { kind: "normal", off: [] });
    assert.deepEqual(standingOf(RULE, measured({ business: group(2) }, { bench: { planted: 3, found: 3, falseAlarms: 0 } }), NONE), {
      kind: "normal",
      off: [],
    });
  });

  it("一割を超える group があれば info で動く。ちょうど一割は超えていない", () => {
    assert.equal(NORMAL_MAX_SHARE, 0.1);
    assert.equal(standingOf(RULE, measured({ business: group(3) }), NONE).kind, "info");
    assert.equal(standingOf(RULE, measured({ business: group(2) }), NONE).kind, "normal");
  });

  it("bench の誤報か見逃しがあれば、出る文書が少なくても info", () => {
    assert.equal(BENCH_MIN_PRECISION, 1);
    assert.equal(standingOf(RULE, measured({ business: group(0) }, { bench: { planted: 3, found: 3, falseAlarms: 1 } }), NONE).kind, "info");
    assert.equal(standingOf(RULE, measured({ business: group(0) }, { bench: { planted: 3, found: 2, falseAlarms: 0 } }), NONE).kind, "info");
    assert.equal(standingOf(RULE, measured({ business: group(0) }, { aiBench: { hits: 2, samples: 6, falseAlarms: 1, cleanSamples: 12 } }), NONE).kind, "info");
  });

  it("半分を超える group では止める。止めた group と、genres.yaml が手で止めた group は info の判断に入れない", () => {
    assert.equal(OFF_MIN_SHARE, 0.5);
    assert.deepEqual(standingOf(RULE, measured({ legal: group(11), business: group(1) }), NONE), { kind: "normal", off: ["legal"] });
    assert.deepEqual(standingOf(RULE, measured({ legal: group(10), business: group(1) }), NONE), { kind: "info", off: [] });
    assert.deepEqual(standingOf(RULE, measured({ legal: group(10), business: group(1) }), new Set(["legal"])), { kind: "normal", off: [] });
  });

  it("文書の足りない group は決めない。どの group も足りなければ、測っていないのと同じで experimental のまま", () => {
    assert.deepEqual(standingOf(RULE, measured({ speech: group(MIN_DOCUMENTS - 1, MIN_DOCUMENTS - 1), blog: group(0) }), NONE), { kind: "normal", off: [] });
    assert.deepEqual(standingOf(RULE, measured({ speech: group(1, MIN_DOCUMENTS - 1) }), NONE), { kind: "experimental" });
    assert.deepEqual(standingOf(RULE, measured({}), NONE), { kind: "experimental" });
    assert.deepEqual(standingOf(RULE, undefined, NONE), { kind: "experimental" });
  });

  it("意味を読む rule（L4）は chaff test のもの。ここでは決めない", () => {
    assert.deepEqual(standingOf({ ...RULE, layer: "L4" }, measured({ business: group(20) }), NONE), { kind: "judge" });
  });
});

const GENRES = parseGenres({
  groups: [
    { id: "legal", name: { ja: "法務", en: "Legal" }, rules: { "hand-off": "off", "some-rule": "off" } },
    { id: "blog", name: { ja: "ブログ", en: "Blog" } },
  ],
  genres: [
    { id: "legal/contract", name: { ja: "契約", en: "Contract" }, summary: { ja: "契", en: "C" }, rules: { "back-on": "normal" } },
    { id: "blog/tech", name: { ja: "技術", en: "Tech" }, summary: { ja: "技", en: "T" } },
  ],
});

const ruleOf = (id: string, status: "experimental" | "stable", severity: "info" | "warning"): RuleDefinition => {
  const base = loadRules("en").find((rule) => rule.id === "doubled-word");
  if (base === undefined) throw new Error("doubled-word is missing");
  return { ...base, id, status, severity, level_sets: "limit", levels: { strict: 1, normal: 2, relaxed: 3 } };
};

describe("disagreements", () => {
  const info: Standing = { kind: "info", off: [] };

  it("測った結果と status・重さ・ジャンルの off が合っていれば何も言わない", () => {
    assert.deepEqual(disagreements(ruleOf("some-rule", "stable", "info"), { kind: "info", off: ["legal"] }, GENRES, []), []);
    assert.deepEqual(disagreements(ruleOf("x", "experimental", "warning"), { kind: "experimental" }, GENRES, []), []);
    assert.deepEqual(disagreements(ruleOf("x", "stable", "warning"), { kind: "judge" }, GENRES, []), []);
  });

  it("status が違う、info のはずが warning、止めるはずの group で動く、をそれぞれ言う", () => {
    assert.match(disagreements(ruleOf("x", "experimental", "info"), info, GENRES, []).join("\n"), /status is experimental, the measurement says stable/u);
    assert.match(disagreements(ruleOf("x", "stable", "warning"), { kind: "experimental" }, GENRES, []).join("\n"), /says experimental/u);
    assert.match(disagreements(ruleOf("x", "stable", "warning"), info, GENRES, []).join("\n"), /reports at warning, the measurement says info/u);
    assert.match(disagreements(ruleOf("x", "stable", "warning"), { kind: "normal", off: ["blog"] }, GENRES, []).join("\n"), /runs in blog\/tech/u);
  });

  it("group で止めても、ジャンルが戻していれば動いていると言う", () => {
    assert.match(disagreements(ruleOf("back-on", "stable", "warning"), { kind: "normal", off: ["legal"] }, GENRES, []).join("\n"), /runs in legal\/contract/u);
  });

  it("測って止めた行（# measured）は、測った結果がもう止めないと言えば外させる。手で止めた行には言わない", () => {
    const marks = [{ group: "legal", rule: "some-rule" }];
    assert.match(disagreements(ruleOf("some-rule", "stable", "warning"), { kind: "normal", off: [] }, GENRES, marks).join("\n"), /no longer says so/u);
    assert.deepEqual(disagreements(ruleOf("hand-off", "stable", "warning"), { kind: "normal", off: [] }, GENRES, marks), []);
  });
});

describe("rules-measure-score", () => {
  it("文書ごとの結果を、rule と group ごとに数える。動かなかった文書は分母に入れない", () => {
    const runs = [
      { group: "blog", ran: new Set(["a", "b"]), fired: new Set(["a"]) },
      { group: "blog", ran: new Set(["a"]), fired: new Set<string>() },
      { group: "legal", ran: new Set(["a"]), fired: new Set(["a"]) },
    ];
    assert.deepEqual(groupShares(runs), {
      a: { blog: { documents: 2, fired: 1 }, legal: { documents: 1, fired: 1 } },
      b: { blog: { documents: 1, fired: 0 } },
    });
    assert.deepEqual(overallShares(runs), { a: { documents: 3, fired: 2 }, b: { documents: 1, fired: 0 } });
    assert.deepEqual(groupShares([]), {});
  });

  it("bench の表の行と、AI 形の bench の表を読む。読めない行は無視する", () => {
    assert.deepEqual(benchRowOf("table  4  3  1  2\nja/a  m  found"), { planted: 4, found: 3, falseAlarms: 2 });
    assert.equal(benchRowOf("ja/a  m  found"), undefined);
    assert.equal(benchRowOf(""), undefined);
    const ai = [
      "## ja",
      "rule  hits (b) ai  false (a) human  false (c) rewritten  false corpus",
      "ai-tell  2/3  0/3  1/3  0/63",
      "",
      "## en",
      "ai-tell  1/3  1/3  0/3  0/74",
      "garbage",
    ];
    assert.deepEqual(aiBenchRows(ai.join("\n")), { "ai-tell": { hits: 3, samples: 6, falseAlarms: 2, cleanSamples: 12 } });
  });

  it("bench の正しさは、見つけた数と誤報の数から。何も言わなかった rule には無い", () => {
    assert.equal(benchPrecision({ bench: { planted: 4, found: 3, falseAlarms: 1 } }), 0.75);
    assert.equal(benchPrecision({ bench: { planted: 4, found: 3, falseAlarms: 0 }, aiBench: { hits: 1, samples: 6, falseAlarms: 1, cleanSamples: 12 } }), 0.8);
    assert.equal(benchPrecision({ bench: { planted: 0, found: 0, falseAlarms: 0 } }), undefined);
    assert.equal(benchPrecision({}), undefined);
  });

  it("書き出すものに baseline の数は入れない。読んだ JSON の形を確かめる", () => {
    const measurement = { rules: { a: { groups: { blog: group(1) }, baseline: group(3, 100) } } };
    assert.deepEqual(withoutBaseline(measurement), { rules: { a: { groups: { blog: group(1) } } } });
    assert.equal(isMeasurement(measurement), true);
    [null, [], { rules: [] }, { rules: { a: { groups: { blog: { documents: "1", fired: 0 } } } } }, { rules: { a: {} } }].forEach((value) =>
      assert.equal(isMeasurement(value), false, JSON.stringify(value)),
    );
  });
});

describe("rules-apply", () => {
  const counting = "id: x\nlayer: L2\nstatus: experimental\nseverity: warning\n\nlevels: { strict: 1, normal: 2, relaxed: 3 }\n";
  const graded = "id: y\nstatus: stable\nseverity: warning\n# 段は重さ\nlevels: { strict: error, normal: warning, relaxed: info }\n";

  it("status の行だけを書き換える", () => {
    assert.equal(withStatus(counting, "stable"), counting.replace("status: experimental", "status: stable"));
    assert.equal(withStatus(counting, "experimental"), counting);
    assert.throws(() => withStatus("id: x\n", "stable"), /no status line/u);
  });

  it("数える rule は severity を info に。重さを段に持つ rule は、normal が info になるまで段ごと一つ下げる", () => {
    assert.equal(withInfoAtNormal(counting), counting.replace("severity: warning", "severity: info"));
    assert.equal(withInfoAtNormal(graded), "id: y\nstatus: stable\nseverity: info\n# 段は重さ\nlevels: { strict: warning, normal: info, relaxed: info }\n");
    const errorAtNormal = "severity: error\nlevels: { normal: error, relaxed: warning }\n";
    assert.equal(withInfoAtNormal(errorAtNormal), "severity: info\nlevels: { normal: info, relaxed: info }\n");
    assert.throws(() => withInfoAtNormal("id: x\n"), /no severity line/u);
  });

  it("言語ごとに書いた重さは一つの info にまとめる。言語ごとに書いた重さの段は書き換えずに止まる", () => {
    const perLanguage = "id: z\nseverity:\n  ja: warning\n  en: info\n\nlevels: { strict: 3, normal: 8, relaxed: 20 }\n";
    assert.equal(withInfoAtNormal(perLanguage), "id: z\nseverity: info\n\nlevels: { strict: 3, normal: 8, relaxed: 20 }\n");
    assert.equal(withInfoAtNormal("severity:\n  ja: warning\n  en: info"), "severity: info");
    const levelsPerLanguage = "severity: warning\nlevels:\n  ja: { strict: error, normal: warning }\n  en: { strict: error, normal: warning }\n";
    assert.throws(() => withInfoAtNormal(levelsPerLanguage), /per language/u);
  });

  const genres = [
    "groups:",
    "  - id: technical",
    "    name: { ja: 技術文書, en: Technical }",
    "  # comment of the next group",
    "  - id: legal",
    "    name: { ja: 法務, en: Legal }",
    "    rules:",
    "      hand-off: off",
    "      # why",
    "      old: off  # measured",
    "",
    "genres:",
    "  - id: legal/contract",
    "    rules:",
    "      fake: off  # measured",
    "",
  ].join("\n");

  it("measured の行を group ごとに読む。genres: より下は group ではない", () => {
    assert.deepEqual(measuredOffsOf(genres), [{ group: "legal", rule: "old" }]);
  });

  it("measured の行を入れ替える。rules: の無い group には作り、手で止めた rule には足さず、空になった rules: は消す", () => {
    const updated = withMeasuredOffs(genres, [
      { group: "technical", rule: "b-rule" },
      { group: "technical", rule: "a-rule" },
      { group: "legal", rule: "hand-off" },
    ]);
    assert.equal(
      updated,
      [
        "groups:",
        "  - id: technical",
        "    name: { ja: 技術文書, en: Technical }",
        "    rules:",
        "      a-rule: off  # measured",
        "      b-rule: off  # measured",
        "  # comment of the next group",
        "  - id: legal",
        "    name: { ja: 法務, en: Legal }",
        "    rules:",
        "      hand-off: off",
        "      # why",
        "",
        "genres:",
        "  - id: legal/contract",
        "    rules:",
        "      fake: off  # measured",
        "",
      ].join("\n"),
    );
    assert.deepEqual(measuredOffsOf(updated), [
      { group: "technical", rule: "a-rule" },
      { group: "technical", rule: "b-rule" },
    ]);
    assert.equal(withMeasuredOffs(updated, measuredOffsOf(updated)), updated);
    assert.throws(() => withMeasuredOffs(genres, [{ group: "nope", rule: "a" }]), /no group nope/u);
  });

  it("measured の行がすべて消えた group の rules: は残さない", () => {
    const only = ["groups:", "  - id: blog", "    name: { ja: ブログ, en: Blog }", "    rules:", "      x: off  # measured", "", "genres:"].join("\n");
    assert.equal(withMeasuredOffs(only, []), ["groups:", "  - id: blog", "    name: { ja: ブログ, en: Blog }", "", "genres:"].join("\n"));
  });
});

describe("committed measurement", () => {
  const skip = existsSync(MEASURE_FILE) ? false : "no corpus/rules-measure.json yet (yarn rules:measure --write)";
  it(`every rule's status, severity and genre offs agree with corpus/rules-measure.json (yarn rules:measure --apply)`, { skip }, () => {
    assert.deepEqual(policyProblems(readMeasurement()), []);
  });
});
