import { readdir } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

/**
 * Which directories a run measures (spec §9.3), following `repo.json` §9.
 *
 * scoria measures one directory and never wanders out of it. The tools it drives are rooted: `tsc`
 * reads the tsconfig it is given, `audit` reads one lockfile, `knip` resolves one dependency graph.
 * Point them at a repository holding two projects and they see the outer one while the file probes
 * count both — ownplate's `functions/` has its own tsconfig, package.json and lockfile, and its 4
 * high advisories were invisible while its 93 files sat in the denominator.
 *
 * The expansion rules are not scoria's. They are `repo.json` §9.2-§9.3, so that a repository
 * declaring its units once is read the same way by every tool that reads them.
 */

const WILDCARD = "*";
const VENDORED: ReadonlySet<string> = new Set(["node_modules", "vendor"]);

export type TargetProblem =
  | { readonly kind: "unsupported-pattern"; readonly pattern: string }
  | { readonly kind: "outside-repository"; readonly pattern: string }
  | { readonly kind: "no-match"; readonly pattern: string }
  | { readonly kind: "missing"; readonly pattern: string }
  | { readonly kind: "duplicate"; readonly pattern: string };

export interface TargetSet {
  /** Absolute directories, in declaration order, each named once. */
  readonly paths: readonly string[];
  /** What was dropped and why (`repo.json` §11.3). Silence would read as "nothing was dropped". */
  readonly problems: readonly TargetProblem[];
}

export class NoTargetsMatched extends Error {
  readonly patterns: readonly string[];

  constructor(patterns: readonly string[]) {
    super(`no directory matched ${patterns.join(", ")}`);
    this.name = "NoTargetsMatched";
    this.patterns = patterns;
  }
}

/**
 * `repo.json` §9.3 orders wildcard matches by UTF-16 code unit and says so explicitly, because
 * `localeCompare` and a plain comparison disagree on exactly the names a monorepo has — case,
 * digits, accents. Two tools listing the same packages in two orders is what that rule prevents.
 */
const byCodeUnit = (a: string, b: string): number => {
  if (a < b) return -1;
  return a > b ? 1 : 0;
};

/** §9.2: a segment that is exactly `*`. `**`, and `*` inside a longer segment, are not defined. */
const segmentsOf = (pattern: string): readonly string[] => pattern.split("/").filter((segment) => segment !== "" && segment !== ".");

const isSupported = (segments: readonly string[]): boolean =>
  segments.every((segment) => !segment.includes(WILDCARD) || segment === WILDCARD) && !segments.includes("..");

/** §9.2: never a name beginning with `.`, and not a directory the ecosystem treats as vendored. */
const listDirectories = async (dir: string): Promise<readonly string[]> => {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  return entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith(".") && !VENDORED.has(entry.name))
    .map((entry) => entry.name)
    .toSorted(byCodeUnit);
};

const isDirectory = async (path: string): Promise<boolean> =>
  readdir(path).then(
    () => true,
    () => false,
  );

/** Walks one segment at a time so a `*` expands against what is actually on disk, in order. */
const descend = async (roots: readonly string[], segment: string): Promise<readonly string[]> => {
  if (segment !== WILDCARD) return roots.map((root) => join(root, segment));
  const found = await Promise.all(roots.map(async (root) => (await listDirectories(root)).map((name) => join(root, name))));
  return found.flat();
};

const expandOne = async (root: string, pattern: string): Promise<readonly string[]> => {
  const segments = segmentsOf(pattern);
  let reached: readonly string[] = [root];
  for (const segment of segments) {
    reached = await descend(reached, segment);
  }
  return reached;
};

/** §6: a path that leaves the repository after normalisation is rejected, not clamped. */
const withinRoot = (root: string, path: string): boolean => {
  const inside = relative(root, path);
  return inside === "" || (!inside.startsWith(`..${sep}`) && inside !== ".." && !isAbsolute(inside));
};

interface Resolution {
  readonly paths: readonly string[];
  readonly problems: readonly TargetProblem[];
}

const resolveOne = async (root: string, pattern: string): Promise<Resolution> => {
  const segments = segmentsOf(pattern);
  if (isAbsolute(pattern) || !isSupported(segments)) return { paths: [], problems: [{ kind: "unsupported-pattern", pattern }] };
  const found = (await expandOne(root, pattern)).filter((path) => withinRoot(root, path));
  if (found.length === 0) return { paths: [], problems: [{ kind: "no-match", pattern }] };
  const directories = (await Promise.all(found.map(async (path) => ((await isDirectory(path)) ? [path] : [])))).flat();
  if (directories.length === 0) return { paths: [], problems: [{ kind: segments.includes(WILDCARD) ? "no-match" : "missing", pattern }] };
  return { paths: directories, problems: [] };
};

/**
 * §9.3: declaration order is significant, and one directory is one project however many entries
 * name it — the first naming it wins its position.
 */
export const resolveTargets = async (root: string, patterns: readonly string[]): Promise<TargetSet> => {
  if (patterns.length === 0) return { paths: [resolve(root)], problems: [] };
  const resolved = await Promise.all(patterns.map((pattern) => resolveOne(resolve(root), pattern)));
  const seen = new Set<string>();
  const paths: string[] = [];
  const problems = resolved.flatMap((entry, index) => {
    const duplicates = entry.paths.filter((path) => seen.has(path));
    entry.paths.filter((path) => !seen.has(path)).forEach((path) => (seen.add(path), paths.push(path)));
    return [...entry.problems, ...(duplicates.length > 0 ? [{ kind: "duplicate" as const, pattern: patterns[index] ?? "" }] : [])];
  });
  return { paths, problems };
};

/** Kept for callers that only want the directories and treat an empty result as fatal. */
export const expandTargets = async (root: string, patterns: readonly string[]): Promise<readonly string[]> => {
  const { paths } = await resolveTargets(root, patterns);
  if (paths.length === 0) throw new NoTargetsMatched(patterns);
  return paths;
};

/**
 * `repo.json` §9.4: a project's extent is its directory minus the directories of any nested
 * projects. Without this, measuring `[".", "functions"]` counts `functions/` twice — once as its
 * own project and once inside the root's.
 */
export const nestedWithin = (target: string, all: readonly string[]): readonly string[] =>
  all.filter((other) => other !== target && withinRoot(target, other) && relative(target, other) !== "");
