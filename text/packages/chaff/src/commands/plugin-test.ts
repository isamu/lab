import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { EMPTY, type Config } from "../config/load.ts";
import { withExtensions } from "../extension/load.ts";
import { extensionProblems } from "../extension/problem-text.ts";
import { loadGenres } from "../genre-load.ts";
import type { RuleDefinition } from "../plugin.ts";
import type { Skipped } from "../run.ts";
import type { Texts, UiLanguage } from "../ui.ts";
import type { Checked } from "./feedback.ts";

// chaff plugin-test [folder]: loads a plugin as chaff.yaml would, then runs each of its rules on the rule's own example,
// in every language the example is written in. The before must give the rule a finding and the after must give it
// none. A rule that does not run there (no word list for the language) fails, with the reason.

export type PluginTestContext = {
  readonly ui: UiLanguage;
  /** Lints one file with these settings, as chaff on the command line does. */
  readonly check: (path: string, config: Config, argv: readonly string[]) => Promise<Pick<Checked, "findings" | "skipped">>;
};

type Outcome = { readonly rule: string; readonly language: string; readonly failure: string | undefined };

const TEXT: Texts<{
  readonly noRules: (dir: string) => string;
  readonly beforeQuiet: string;
  readonly afterFlagged: (count: number) => string;
  readonly notRun: (why: string) => string;
  readonly noExample: string;
  readonly summary: (passed: number, total: number) => string;
}> = {
  ja: {
    noRules: (dir) => `${dir} にルールがありません。`,
    beforeQuiet: "例の before で指摘が出ません",
    afterFlagged: (count) => `例の after で指摘が ${String(count)} 件出ます`,
    notRun: (why) => `動きません（${why}）`,
    noExample: "例がありません",
    summary: (passed, total) => `${String(total)} 件のうち ${String(passed)} 件が通りました。`,
  },
  en: {
    noRules: (dir) => `${dir} has no rules.`,
    beforeQuiet: "the example's before gets no finding",
    afterFlagged: (count) => `the example's after gets ${String(count)} ${count === 1 ? "finding" : "findings"}`,
    notRun: (why) => `it does not run (${why})`,
    noExample: "it has no example",
    summary: (passed, total) => `${String(passed)} of ${String(total)} passed.`,
  },
};

/** The first genre the rule is for: the example runs where the rule does. */
const genreFor = (rule: RuleDefinition): string => {
  const genres = loadGenres().genres.map((genre) => genre.id);
  return genres.find((genre) => rule.use_for.some((target) => genre === target || genre.startsWith(`${target}/`))) ?? genres[0] ?? "business/report";
};

const skippedWhy = (skipped: readonly Skipped[], rule: string): string | undefined => skipped.find((entry) => entry.rule === rule)?.why;

/** One rule in one language: before flagged, after clean. */
const testExample = async (rule: RuleDefinition, language: string, config: Config, context: PluginTestContext): Promise<Outcome> => {
  const text = TEXT[context.ui];
  const example = rule.guide?.examples[language];
  if (example === undefined) return { rule: rule.id, language, failure: text.noExample };
  const dir = mkdtempSync(join(tmpdir(), "chaff-plugin-test-"));
  const argv = ["--language", language, "--genre", genreFor(rule)];
  const run = async (name: string, body: string): Promise<Pick<Checked, "findings" | "skipped">> => {
    writeFileSync(join(dir, name), `${body.trimEnd()}\n`, "utf8");
    return context.check(join(dir, name), config, argv);
  };
  const before = await run("before.md", example.before);
  const why = skippedWhy(before.skipped, rule.id);
  if (why !== undefined) return { rule: rule.id, language, failure: text.notRun(why) };
  if (!before.findings.some((finding) => finding.rule === rule.id)) return { rule: rule.id, language, failure: text.beforeQuiet };
  const after = (await run("after.md", example.after)).findings.filter((finding) => finding.rule === rule.id).length;
  return { rule: rule.id, language, failure: after === 0 ? undefined : text.afterFlagged(after) };
};

const lineOf = (outcome: Outcome): string =>
  outcome.failure === undefined ? `  ✓ ${outcome.rule} (${outcome.language})` : `  ✗ ${outcome.rule} (${outcome.language}): ${outcome.failure}`;

/** The languages a rule's example is written in, or the rule's languages when it has none, so a missing example is said. */
const languagesOf = (rule: RuleDefinition): readonly string[] => {
  const written = Object.keys(rule.guide?.examples ?? {});
  return written.length > 0 ? written : (rule.languages ?? ["ja", "en"]);
};

/** Exit 0 when every rule passes on every example; 1 when the plugin cannot be loaded or a rule fails. */
export const runPluginTest = async (folder: string | undefined, context: PluginTestContext): Promise<number> => {
  const text = TEXT[context.ui];
  const dir = resolve(folder ?? ".");
  const config = await withExtensions({ ...EMPTY, plugins: [dir], baseDir: dir, path: dir });
  const problems = extensionProblems(config, context.ui);
  if (problems.length > 0) {
    problems.forEach((problem) => console.error(problem));
    return 1;
  }
  const rules = config.extensions?.rules ?? [];
  if (rules.length === 0) {
    console.error(text.noRules(dir));
    return 1;
  }
  const cases = rules.flatMap((rule) => languagesOf(rule).map((language) => ({ rule, language })));
  const outcomes = await cases.reduce<Promise<Outcome[]>>(
    async (done, entry) => [...(await done), await testExample(entry.rule, entry.language, config, context)],
    Promise.resolve([]),
  );
  outcomes.map(lineOf).forEach((line) => console.log(line));
  const passed = outcomes.filter((outcome) => outcome.failure === undefined).length;
  console.log(`\n${text.summary(passed, outcomes.length)}`);
  return passed === outcomes.length ? 0 : 1;
};
