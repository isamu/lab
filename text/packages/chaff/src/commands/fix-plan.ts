import { existsSync } from "node:fs";
import { outlineOf } from "../outline/shape.ts";
import { structureOf } from "../structure-shape/of-document.ts";
import { buildFixPlan } from "../fix-plan/plan.ts";
import { renderFixPlanJson, renderFixPlanMarkdown } from "../fix-plan/render.ts";
import { FIX_PLAN_TEXT } from "../fix-plan/text.ts";
import { chosenDepthOf } from "../fix-plan/chosen-depth.ts";
import type { Checked } from "./feedback.ts";
import { readDocument } from "./read-document.ts";
import type { TreeContext } from "./tree.ts";

/** Options whose value is the next argument. That value is not a file. */
const VALUED: ReadonlySet<string> = new Set(["--language", "--genre", "--depth"]);

/** --depth's value: undefined when not given, empty when given with nothing after it (which is then reported). */
const depthFlag = (argv: readonly string[], context: FixPlanContext): string | undefined =>
  argv.includes("--depth") ? (context.flag(argv, "--depth") ?? "") : undefined;

export const fixPlanTargets = (argv: readonly string[]): string[] =>
  argv.slice(1).filter((arg, index, all) => !arg.startsWith("--") && !VALUED.has(all[index - 1] ?? ""));

export type FixPlanContext = TreeContext & {
  /** The file's findings as lint finds them, shelved ones included. */
  readonly check: (path: string) => Promise<Omit<Checked, "conditions">>;
};

/**
 * An instruction document for whoever rewrites the file: the findings grouped by rule, each rule's rewrite direction,
 * the document-level signals, the structure targets from human articles, a recommended mode and the checks to run after. Deterministic; sends nothing anywhere.
 */
export const runFixPlan = async (targets: readonly string[], argv: readonly string[], context: FixPlanContext): Promise<number> => {
  // Checked first: a file name written after --depth by mistake is reported as the depth it was read as.
  const depth = chosenDepthOf(depthFlag(argv, context), context.config.fixPlan, context.ui ?? "ja");
  if ("problem" in depth) {
    console.error(`chaff: ${depth.problem}`);
    return 1;
  }
  const [path] = targets;
  if (path === undefined || targets.length > 1) {
    console.error(FIX_PLAN_TEXT[context.ui ?? "ja"].usage);
    return 1;
  }
  if (!existsSync(path)) {
    console.error(FIX_PLAN_TEXT[context.ui ?? "ja"].notFound(path));
    return 1;
  }
  const checked = await context.check(path);
  // The outline is read in the language lint chose, so the plan's findings and its outline describe one reading.
  const prose = await readDocument(path, ["fix-plan", "--language", checked.language, ...argv.slice(1)], context, false);
  if (prose === undefined) return 1;
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
    structure: structureOf(prose.doc),
    phrases: prose.doc.lexicons["ai-tell"] ?? [],
    chosenDepth: depth.chosen,
  });
  console.log(argv.includes("--json") ? renderFixPlanJson(plan) : renderFixPlanMarkdown(plan));
  return 0;
};
