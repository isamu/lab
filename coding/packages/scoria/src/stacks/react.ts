import type { FileKind, StackAdapter, StackDetection } from "../plugin.ts";
import { readPackageJson, hasDependency } from "../package-json.ts";

/**
 * React shares .tsx / .jsx handling with the ts stack, so it adds nothing to classification.
 * It exists as its own stack so detection can be frozen into the config, and because the coming
 * UI-dimension probes (design tokens, component shape) will need React-specific knowledge.
 */
const classify = (): FileKind => "ignored";

const detect = async (root: string): Promise<StackDetection> => {
  const pkg = await readPackageJson(root);
  const evidence = ["react", "next"].filter((name) => hasDependency(pkg, name)).map((name) => `dependencies.${name}`);
  return { matched: evidence.length > 0, confidence: evidence.length > 0 ? 1 : 0, evidence };
};

export const stackReact: StackAdapter = { kind: "stack", id: "react", apiVersion: 1, detect, classify };
