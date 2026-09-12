import { glob } from "node:fs/promises";
import { resolve } from "node:path";

/**
 * Which directories a run measures (spec §9.3).
 *
 * scoria measures one directory and never wanders out of it. The tools it drives are rooted: `tsc`
 * reads the tsconfig it is given, `audit` reads one lockfile, `knip` resolves one dependency graph.
 * Point them at a repository holding two projects and they see the outer one while the file probes
 * count both — ownplate's `functions/` has its own tsconfig, package.json and lockfile, and its 4
 * high advisories were invisible while its 93 files sat in the denominator.
 *
 * Rather than guess where the boundaries are, scoria asks. Without `targets` it measures exactly
 * the directory it was pointed at, which is what a single-project repository wants and what every
 * existing config already means.
 */

export class NoTargetsMatched extends Error {
  readonly patterns: readonly string[];

  constructor(patterns: readonly string[]) {
    super(`no directory matched ${patterns.join(", ")}`);
    this.name = "NoTargetsMatched";
    this.patterns = patterns;
  }
}

const matchesOf = async (root: string, pattern: string): Promise<readonly string[]> => {
  const found: string[] = [];
  for await (const entry of glob(pattern, { cwd: root, withFileTypes: true, exclude: ["node_modules"] })) {
    if (entry.isDirectory()) found.push(resolve(entry.parentPath, entry.name));
  }
  return found;
};

/**
 * A pattern that matches nothing is a typo, not an empty repository. Measuring zero directories
 * and reporting success is the one outcome nobody would notice was wrong.
 */
export const expandTargets = async (root: string, patterns: readonly string[]): Promise<readonly string[]> => {
  if (patterns.length === 0) return [root];
  const found = (await Promise.all(patterns.map((pattern) => matchesOf(root, pattern)))).flat();
  const unique = [...new Set(found)].toSorted((a, b) => a.localeCompare(b));
  if (unique.length === 0) throw new NoTargetsMatched(patterns);
  return unique;
};
