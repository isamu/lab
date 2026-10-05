import { aiScoreTargets, runAiScore } from "./ai-score.ts";
import { citeTargets, runCite } from "./cite.ts";
import { compareTargets, runCompare } from "./compare.ts";
import { factsTargets, runFacts } from "./facts.ts";
import { outlineTargets, runOutline } from "./outline.ts";
import { runTree, treeTargets, type TreeContext } from "./tree.ts";

type DocumentCommand = (argv: readonly string[], context: TreeContext) => Promise<number>;

/**
 * The commands that read one or two documents and report on them without linting: the tree, quotations, facts and
 * outline. Each is given the settings the command line read once.
 */
export const DOCUMENT_COMMANDS: Readonly<Record<string, DocumentCommand>> = {
  tree: (argv, context) => runTree(treeTargets(argv), argv, context),
  cite: (argv, context) => runCite(citeTargets(argv), argv, context),
  compare: (argv, context) => runCompare(compareTargets(argv), argv, context),
  facts: (argv, context) => runFacts(factsTargets(argv), argv, context),
  outline: (argv, context) => runOutline(outlineTargets(argv), argv, context),
  "ai-score": (argv, context) => runAiScore(aiScoreTargets(argv), argv, context),
};
