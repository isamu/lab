import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { checkSource, crossChecked, type SourceCheck } from "../packages/chaff/src/check-source.ts";
import { EMPTY } from "../packages/chaff/src/config/load.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRulesWith } from "../packages/chaff/src/run.ts";
import { applySuppressions } from "../packages/chaff/src/stet.ts";
import { fingerprints, splitByBaseline, type Baseline } from "../packages/chaff/src/baseline.ts";
import { REASONS } from "../packages/chaff/src/reasons.ts";
import type { CrossDetector, DocumentFinding, Level, ProseDocument, RuleDefinition } from "../packages/chaff/src/plugin.ts";

// The pass over several documents: a rule with requires: [documents] sees every document of the run that its gates let in,
// and each of its findings lands in one file. The rule here is a stand-in (fact-conflict's texts, a detector of the test's own).

const RULE = "test-cross";

const base = loadRules("en").find((rule) => rule.id === "fact-conflict");
if (base === undefined) throw new Error("no fact-conflict");

const crossRule = (overrides: Partial<RuleDefinition> = {}): RuleDefinition => ({
  ...base,
  id: RULE,
  how_to_find: RULE,
  status: "stable",
  requires: ["documents"],
  ...overrides,
});

/** One file checked as `chaff <file>` checks it, with the stand-in rule among its rules. */
const checkOf = async (path: string, text: string, rule: RuleDefinition, level?: Level): Promise<SourceCheck> => {
  const config = level === undefined ? EMPTY : { ...EMPTY, rules: { [RULE]: level } };
  const check = await checkSource(path, text, config, { experimental: false });
  const rules = [...check.rules, rule];
  const context = { ...check.context, settings: config.rules };
  const raw = runRulesWith(check.doc, rules, context);
  const sections = check.doc.sections.map((section) => section.span);
  return { ...check, rules, context, raw, applied: applySuppressions(check.doc.source, raw.findings, sections) };
};

/** A detector that reports the first "beta" of every document, and records which documents it was given. */
const recording = (seen: string[][]): CrossDetector => {
  return (docs) => {
    seen.push(docs.map((doc) => doc.path));
    return docs.flatMap((doc): DocumentFinding[] => {
      const at = doc.source.indexOf("beta");
      return at === -1 ? [] : [{ path: doc.path, finding: { rule: "", severity: "warning", line: 0, column: 0, quote: "beta", values: { offset: at } } }];
    });
  };
};

const reasonsOf = (check: SourceCheck): string[] => check.raw.skipped.filter((entry) => entry.rule === RULE).map((entry) => entry.why);
const placesOf = (check: SourceCheck): string[] =>
  check.applied.kept.filter((finding) => finding.rule === RULE).map((finding) => `${String(finding.line)}:${String(finding.column)}:${finding.severity}`);

const ONE_DOCUMENT = REASONS.en.oneDocument;

describe("cross-document pass: who takes part", () => {
  it("one file alone: the rule did not run, and says it needs more than one document", async () => {
    const [only] = crossChecked([await checkOf("a.md", "# A\n\nalpha beta\n", crossRule())], { [RULE]: recording([]) });
    assert.ok(only !== undefined);
    assert.deepEqual(reasonsOf(only), [ONE_DOCUMENT]);
    assert.deepEqual(placesOf(only), []);
  });

  it("two files: the detector gets both, each finding lands in its own file at its own line and column", async () => {
    const seen: string[][] = [];
    const checks = [await checkOf("a.md", "# A\n\nalpha beta\n", crossRule()), await checkOf("b.md", "# B\n\nfirst\n\nthen beta\n", crossRule())];
    const [a, b] = crossChecked(checks, { [RULE]: recording(seen) });
    assert.deepEqual(seen, [["a.md", "b.md"]]);
    assert.deepEqual(a === undefined ? [] : placesOf(a), ["3:7:warning"]);
    assert.deepEqual(b === undefined ? [] : placesOf(b), ["5:6:warning"]);
    assert.deepEqual(a === undefined ? [] : reasonsOf(a), []);
  });

  it("a rule turned off says so, and its file does not take part", async () => {
    const seen: string[][] = [];
    const rule = crossRule();
    const checks = [await checkOf("a.md", "beta\n", rule, "off"), await checkOf("b.md", "beta\n", rule), await checkOf("c.md", "beta\n", rule)];
    const [a] = crossChecked(checks, { [RULE]: recording(seen) });
    assert.deepEqual(seen, [["b.md", "c.md"]]);
    assert.deepEqual(a === undefined ? [] : reasonsOf(a), [REASONS.en.turnedOff]);
  });

  it("a file the rule cannot read (not Markdown) gives its own reason; one file left keeps the one-document reason", async () => {
    const rule = crossRule({ requires: ["markdown", "documents"] });
    const [a, b] = crossChecked([await checkOf("a.txt", "beta\n", rule), await checkOf("b.md", "beta\n", rule)], { [RULE]: recording([]) });
    assert.deepEqual(a === undefined ? [] : reasonsOf(a), [REASONS.en.notMarkdown]);
    assert.deepEqual(b === undefined ? [] : reasonsOf(b), [ONE_DOCUMENT]);
  });

  it("a rule whose word list the language lacks says so, and its file does not take part", async () => {
    const seen: string[][] = [];
    const rule = crossRule({ extra_word_lists: ["no-such-list"] });
    const [a] = crossChecked([await checkOf("a.md", "beta\n", rule), await checkOf("b.md", "beta\n", rule)], { [RULE]: recording(seen) });
    assert.deepEqual(seen, []);
    assert.deepEqual(a === undefined ? [] : reasonsOf(a), [REASONS.en.noLexicon("en", "no-such-list")]);
  });

  it("a rule without its detector says which detector is missing, in every file that took part", async () => {
    const checks = [await checkOf("a.md", "beta\n", crossRule()), await checkOf("b.md", "beta\n", crossRule())];
    const reasons = crossChecked(checks, {}).map(reasonsOf);
    assert.deepEqual(reasons, [[REASONS.en.noDetector(RULE)], [REASONS.en.noDetector(RULE)]]);
  });

  it("a finding for a path outside the run is dropped", async () => {
    const stray: CrossDetector = () => [
      { path: "elsewhere.md", finding: { rule: "", severity: "warning", line: 0, column: 0, quote: "", values: { offset: 0 } } },
    ];
    const checks = [await checkOf("a.md", "beta\n", crossRule()), await checkOf("b.md", "beta\n", crossRule())];
    assert.deepEqual(crossChecked(checks, { [RULE]: stray }).map(placesOf), [[], []]);
  });

  it("a file that did not take part gets no finding and no reason from the rule, even when the detector names it", async () => {
    const rule = crossRule();
    const pointsAtA: CrossDetector = () => [{ path: "a.md", finding: { rule: "", severity: "warning", line: 0, column: 0, quote: "", values: { offset: 0 } } }];
    const checks = [await checkOf("a.md", "beta\n", rule, "off"), await checkOf("b.md", "beta\n", rule), await checkOf("c.md", "beta\n", rule)];
    const [withDetector] = crossChecked(checks, { [RULE]: pointsAtA });
    const [withoutDetector] = crossChecked(checks, {});
    assert.deepEqual(withDetector === undefined ? [] : placesOf(withDetector), []);
    assert.deepEqual(withoutDetector === undefined ? [] : reasonsOf(withoutDetector), [REASONS.en.turnedOff]);
  });

  it("a run of one file is not touched", async () => {
    const check = await checkOf("a.md", "beta\n", crossRule());
    assert.equal(crossChecked([check])[0], check);
  });
});

describe("cross-document pass: stet and baseline", () => {
  it("a stet in the file the finding lands in silences it there, and only there", async () => {
    const stetted = `<!-- stet-file: ${RULE} — the old name on purpose -->\n\nbeta\n`;
    const [a, b] = crossChecked([await checkOf("a.md", stetted, crossRule()), await checkOf("b.md", "beta\n", crossRule())], { [RULE]: recording([]) });
    assert.deepEqual(a === undefined ? [] : placesOf(a), []);
    assert.equal(a?.applied.suppressed.length, 1);
    assert.deepEqual(b === undefined ? [] : placesOf(b), ["1:1:warning"]);
  });

  it("the baseline shelves a finding by its file", async () => {
    const [a] = crossChecked([await checkOf("a.md", "beta\n", crossRule()), await checkOf("b.md", "beta\n", crossRule())], { [RULE]: recording([]) });
    const kept = a?.applied.kept ?? [];
    const folder = process.cwd();
    const baseline: Baseline = { version: 1, created: "2026-10-03", entries: fingerprints("a.md", kept, folder) };
    assert.equal(splitByBaseline("a.md", kept, baseline, folder).fresh.length, 0);
    assert.equal(splitByBaseline("b.md", kept, baseline, folder).fresh.length, kept.length);
  });
});

/** Proves the stand-in reads what a real run passes: the documents themselves, not copies. */
describe("cross-document pass: the documents given", () => {
  it("are the documents of the run, with their language", async () => {
    const languages: string[] = [];
    const detector: CrossDetector = (docs: readonly ProseDocument[]) => {
      docs.forEach((doc) => languages.push(doc.language));
      return [];
    };
    crossChecked([await checkOf("a.md", "# A\n\nThe fee is due.\n", crossRule()), await checkOf("b.md", "# 料金\n\n料金は前払いです。\n", crossRule())], {
      [RULE]: detector,
    });
    assert.deepEqual(languages, ["en", "ja"]);
  });
});
