import { uiLanguageOf } from "../ui.ts";
import { FACTS_TEXT } from "../compare/facts-text.ts";
import { renderFactsCompact, renderFactsFriendly, renderFactsJson, type FactList } from "../compare/facts-render.ts";
import { readFacts } from "./compare.ts";
import type { TreeContext } from "./tree.ts";

/** Options whose value is the next argument. That value is not a file. */
const VALUED: ReadonlySet<string> = new Set(["--language", "--genre"]);

export const factsTargets = (argv: readonly string[]): string[] =>
  argv.slice(1).filter((arg, index, all) => !arg.startsWith("--") && !VALUED.has(all[index - 1] ?? ""));

const renderFor = (argv: readonly string[], list: FactList): string => {
  const text = FACTS_TEXT[uiLanguageOf(list.language)];
  if (argv.includes("--json")) return renderFactsJson(list);
  return argv.includes("--compact") ? renderFactsCompact(list, text) : renderFactsFriendly(list, text);
};

/**
 * The facts `chaff compare` would check in one document, listed before a rewrite: the inventory a full rewrite
 * starts from. Read by compare's own extractor, so the list is exactly what compare holds the rewrite to.
 */
export const runFacts = async (targets: readonly string[], argv: readonly string[], context: TreeContext): Promise<number> => {
  const [path] = targets;
  if (path === undefined || targets.length !== 1) {
    console.error(FACTS_TEXT[context.ui ?? "ja"].usage);
    return 1;
  }
  const documentFacts = await readFacts(path, argv, context);
  if (documentFacts === undefined) return 1;
  console.log(renderFor(argv, documentFacts));
  return 0;
};
