import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { risenRules } from "../packages/chaff/src/fix-plan/risen.ts";
import { withAllSigns } from "../packages/chaff/src/fix-plan/all-signs.ts";
import { BUNDLED_CHECKS_DIR, checkAppliesTo, checksPathOf, loadChecks } from "../packages/chaff/src/checks.ts";
import { PACKAGE_DIR } from "../packages/chaff/src/package-files.ts";
import type { Finding } from "../packages/chaff/src/plugin.ts";
import { runCli } from "./cli-run.ts";

const finding = (rule: string, line = 1): Finding => ({ rule, severity: "warning", line, column: 1, quote: "", values: {} });

describe("fix-plan --before — the rules a rewrite raised", () => {
  it("names a rule with more findings after, and a rule that was silent before", () => {
    const before = [finding("ai-tell"), finding("max-sentence-length")];
    const after = [finding("max-sentence-length"), finding("max-sentence-length"), finding("doubled-word")];
    assert.deepEqual(risenRules(before, after), [
      { rule: "max-sentence-length", before: 1, after: 2 },
      { rule: "doubled-word", before: 0, after: 1 },
    ]);
  });

  it("names nothing when every rule stayed or fell", () => {
    assert.deepEqual(risenRules([finding("ai-tell"), finding("ai-tell")], [finding("ai-tell")]), []);
    assert.deepEqual(risenRules([finding("ai-tell")], [finding("ai-tell")]), []);
    assert.deepEqual(risenRules([finding("ai-tell")], []), []);
    assert.deepEqual(risenRules([], []), []);
  });
});

describe("fix-plan --all-ai-signs — lint's findings with every AI-likeness rule's", () => {
  const signIds: ReadonlySet<string> = new Set(["closing-cliche", "ai-tell"]);

  it("puts the all-signs run's findings in place of lint's own for those rules, and keeps the rest", () => {
    const lint = { findings: [finding("ai-tell", 3), finding("max-sentence-length", 2)], skipped: [{ rule: "closing-cliche", why: "off" }] };
    const signs = { findings: [finding("ai-tell", 3), finding("closing-cliche", 9)], skipped: [] };
    const merged = withAllSigns(lint, signs, signIds);
    assert.deepEqual(
      merged.findings.map((entry) => `${entry.rule}@${String(entry.line)}`),
      ["max-sentence-length@2", "ai-tell@3", "closing-cliche@9"],
    );
    assert.deepEqual(merged.skipped, [], "a sign rule the genre turned off ran, so it is no longer listed as not run");
  });

  it("keeps lint's other not-run rules, and the all-signs run's own reasons", () => {
    const lint = { findings: [], skipped: [{ rule: "vague-deadline", why: "genre" }] };
    const signs = { findings: [], skipped: [{ rule: "ai-tell", why: "no lexicon" }] };
    assert.deepEqual(
      withAllSigns(lint, signs, signIds).skipped.map((entry) => entry.rule),
      ["vague-deadline", "ai-tell"],
    );
  });
});

/** A short business report that closes on a stock line; closing-cliche does not run in business documents. */
const REPORT = [
  "# Quarterly support report",
  "",
  "The support team closed 412 tickets this quarter, up from 380.",
  "",
  "Median first response time fell from 6 hours to 4 hours after we added a second shift.",
  "",
  "## Next quarter",
  "",
  "We will hire one more agent in April.",
  "",
  "In conclusion, the quarter went well and the team is ready for the next one.",
  "",
].join("\n");

type AllSignsPlan = {
  readonly allSigns: boolean;
  readonly aiScore: { readonly level: string | null; readonly notScored: string | null } | null;
  readonly aiRules: readonly string[];
  readonly since: { readonly risen: readonly { readonly rule: string }[] } | null;
  readonly rules: readonly { readonly rule: string }[];
  readonly checks: readonly string[];
  readonly constraints: readonly string[];
  readonly stop?: readonly string[];
};

const isAllSignsPlan = (value: unknown): value is AllSignsPlan => typeof value === "object" && value !== null && "aiRules" in value;

const planOf = async (files: Readonly<Record<string, string>>, args: readonly string[]): Promise<AllSignsPlan> => {
  const run = await runCli(files, ["fix-plan", ...args, "--genre", "business/report", "--json"], "en_US.UTF-8");
  assert.equal(run.code, 0, run.err);
  const parsed: unknown = JSON.parse(run.out);
  assert.ok(isAllSignsPlan(parsed));
  return parsed;
};

describe("fix-plan --all-ai-signs on a document", () => {
  it("finds an AI-likeness rule the genre leaves out, which the plain plan does not", async () => {
    const plain = await planOf({ "report.md": REPORT }, ["report.md"]);
    assert.ok(!plain.rules.some((rule) => rule.rule === "closing-cliche"));
    assert.equal(plain.allSigns, false);
    assert.equal(plain.aiScore, null);
    const all = await planOf({ "report.md": REPORT }, ["report.md", "--all-ai-signs"]);
    assert.ok(all.rules.some((rule) => rule.rule === "closing-cliche"));
    assert.deepEqual(all.aiRules, ["closing-cliche"]);
    assert.equal(all.aiScore?.notScored, "too-short");
    assert.ok(all.stop !== undefined && all.stop.length > 0);
    assert.match(all.constraints.at(-1) ?? "", /When to stop/u);
  });

  it("checks the rewrite against the original and sends the judgement tells only with --dry-run first", async () => {
    const all = await planOf({ "report.md": REPORT }, ["report.md", "--all-ai-signs"]);
    assert.equal(all.checks[0], "npx chaffjs fix-plan report.rewritten.md --all-ai-signs --before report.md --genre business/report --json");
    assert.equal(all.checks.at(-1), "npx chaffjs test report.rewritten.md --checks ai-tells --genre business/report --dry-run");
  });

  it("with --before, names a rule the rewrite raised, and nothing when the rewrite only removed findings", async () => {
    const longer = REPORT.replace(
      "We will hire one more agent in April.",
      "We will hire one more agent in April, and that agent will cover the late shift on weekdays and the early shift on weekends, which means that the second shift we added this quarter will finally have the cover it needs on every day of the week, including public holidays.",
    );
    const cleaner = REPORT.replace("In conclusion, the quarter went well and the team is ready for the next one.\n", "");
    const files = { "report.md": REPORT, "longer.md": longer, "cleaner.md": cleaner };
    const raised = await planOf(files, ["longer.md", "--all-ai-signs", "--before", "report.md"]);
    assert.ok((raised.since?.risen.length ?? 0) > 0, "a much longer sentence raises a rule");
    assert.ok(!(raised.since?.risen ?? []).some((rule) => rule.rule === "closing-cliche"));
    const removed = await planOf(files, ["cleaner.md", "--all-ai-signs", "--before", "report.md"]);
    assert.deepEqual(removed.since?.risen, []);
    assert.deepEqual(removed.aiRules, []);
  });

  it("says a missing original instead of planning without it", async () => {
    const run = await runCli({ "report.md": REPORT }, ["fix-plan", "report.md", "--before", "gone.md"], "en_US.UTF-8");
    assert.equal(run.code, 1);
    assert.match(run.err, /gone\.md/u);
  });

  it("gives the usage when --before names no file, instead of reading the next option as one", async () => {
    const run = await runCli({ "report.md": REPORT }, ["fix-plan", "report.md", "--before", "--json"], "en_US.UTF-8");
    assert.equal(run.code, 1);
    assert.match(run.err, /usage: chaff fix-plan/u);
  });
});

describe("chaff test --checks — which checks file is read", () => {
  it("reads checks.yaml in the folder without --checks", () => {
    assert.equal(checksPathOf(undefined, "/work", "/pkg/checks"), join("/work", "checks.yaml"));
  });

  it("reads a set chaff ships by its name", () => {
    assert.equal(checksPathOf("ai-tells", "/work", "/pkg/checks"), join("/pkg/checks", "ai-tells.yaml"));
  });

  it("reads a path as a path: relative to the folder, or as given when absolute", () => {
    assert.equal(checksPathOf("team.yaml", "/work", "/pkg/checks"), join("/work", "team.yaml"));
    assert.equal(checksPathOf("conf/team", "/work", "/pkg/checks"), join("/work", "conf/team"));
    assert.equal(checksPathOf("/etc/team.yml", "/work", "/pkg/checks"), "/etc/team.yml");
  });

  it("says a set that is not there, and exits 1 before checking", async () => {
    const run = await runCli({ "a.md": "# A\n\nText.\n" }, ["test", "a.md", "--checks", "no-such-set", "--dry-run"], "en_US.UTF-8");
    assert.equal(run.code, 1);
    assert.match(run.err, /no-such-set/u);
  });

  it("does not read the next option as the set's name", async () => {
    const run = await runCli({ "a.md": "# A\n\nText.\n" }, ["test", "a.md", "--checks", "--dry-run"], "en_US.UTF-8");
    assert.equal(run.code, 1);
    assert.doesNotMatch(run.err, /--checks --dry-run/u);
  });
});

describe("the ai-tells checks chaff ships", () => {
  const checks = loadChecks(join(PACKAGE_DIR, BUNDLED_CHECKS_DIR, "ai-tells.yaml"));

  it("asks every check in both languages, under one id", () => {
    assert.ok(checks.length > 0);
    const ids = [...new Set(checks.map((check) => check.id))];
    ids.forEach((id) => {
      const languages = checks.filter((check) => check.id === id).flatMap((check) => check.languages ?? []);
      assert.deepEqual(
        languages.toSorted((left, right) => left.localeCompare(right)),
        ["en", "ja"],
        id,
      );
    });
  });

  it("asks a check only of a document in its language", () => {
    const [first] = checks;
    assert.ok(first !== undefined);
    const own = first.languages?.[0] ?? "";
    assert.equal(checkAppliesTo(first, own), true);
    assert.equal(checkAppliesTo(first, own === "ja" ? "en" : "ja"), false);
    assert.equal(checkAppliesTo({}, "ja"), true, "a check without languages is asked of every document");
  });

  it("shows in --dry-run only the checks of the document's language", async () => {
    const run = await runCli(
      { "post.md": "# Notes\n\nThis isn't about speed. It's about trust.\n" },
      ["test", "post.md", "--checks", "ai-tells", "--genre", "blog/essay", "--dry-run"],
      "en_US.UTF-8",
    );
    assert.match(run.out, /No denial of what nobody said/u);
    assert.doesNotMatch(run.out, /誰も言っていないことを打ち消さない/u);
  });
});
