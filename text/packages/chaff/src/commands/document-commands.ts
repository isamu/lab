import { citeTargets, runCite } from "./cite.ts";
import { compareTargets, runCompare } from "./compare.ts";
import { factsTargets, runFacts } from "./facts.ts";
import { outlineTargets, runOutline } from "./outline.ts";
import { runTree, treeTargets, type TreeContext } from "./tree.ts";

type DocumentCommand = (argv: readonly string[]) => Promise<number>;

/**
 * The commands that read one or two documents and report on them without linting: the tree, quotations, facts and
 * outline. Each reads the settings when it runs, through `contextOf`.
 */
export const documentCommands = (contextOf: () => TreeContext): Readonly<Record<string, DocumentCommand>> => ({
  tree: (argv) => runTree(treeTargets(argv), argv, contextOf()),
  cite: (argv) => runCite(citeTargets(argv), argv, contextOf()),
  compare: (argv) => runCompare(compareTargets(argv), argv, contextOf()),
  facts: (argv) => runFacts(factsTargets(argv), argv, contextOf()),
  outline: (argv) => runOutline(outlineTargets(argv), argv, contextOf()),
});
