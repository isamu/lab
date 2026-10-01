import { outlineOf } from "../outline/shape.ts";
import { buildFixPlan } from "../fix-plan/plan.ts";
import { renderFixPlanJson, renderFixPlanMarkdown } from "../fix-plan/render.ts";
import { FIX_PLAN_TEXT } from "../fix-plan/text.ts";
import type { Checked } from "./feedback.ts";
import { readDocument } from "./read-document.ts";
import type { TreeContext } from "./tree.ts";

/** Options whose value is the next argument. That value is not a file. */
const VALUED: ReadonlySet<string> = new Set(["--language", "--genre"]);

export const fixPlanTargets = (argv: readonly string[]): string[] =>
  argv.slice(1).filter((arg, index, all) => !arg.startsWith("--") && !VALUED.has(all[index - 1] ?? ""));

export type FixPlanContext = TreeContext & {
  /** The file's findings as lint finds them, shelved ones included. */
  readonly check: (path: string) => Promise<Omit<Checked, "conditions">>;
};

/**
 * An instruction document for whoever rewrites the file: the findings grouped by rule, each rule's rewrite direction,
 * the document-level signals, a recommended mode and the checks to run after. Deterministic; sends nothing anywhere.
 */
export const runFixPlan = async (targets: readonly string[], argv: readonly string[], context: FixPlanContext): Promise<number> => {
  const [path] = targets;
  if (path === undefined || targets.length > 1) {
    console.error(FIX_PLAN_TEXT[context.ui ?? "ja"].usage);
    return 1;
  }
  const prose = await readDocument(path, argv, context, false);
  if (prose === undefined) return 1;
  const checked = await context.check(path);
  const plan = buildFixPlan({
    path,
    language: checked.language,
    genre: checked.genre,
    experimental: context.config.experimental || argv.includes("--experimental"),
    genreFlag: context.flag(argv, "--genre"),
    findings: checked.findings,
    rules: checked.rules,
    skipped: checked.skipped,
    outline: outlineOf(prose.doc),
    phrases: prose.doc.lexicons["ai-tell"] ?? [],
  });
  console.log(argv.includes("--json") ? renderFixPlanJson(plan) : renderFixPlanMarkdown(plan));
  return 0;
};
