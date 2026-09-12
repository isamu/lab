import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { isRecord } from "./package-json.ts";

/**
 * `repo.json` — what a repository says about itself to every tool, not just this one
 * (https://github.com/repos-json/repos-json).
 *
 * scoria reads three things from it. `projects` (§9) says which directories the repository holds,
 * which is the question `targets` exists to answer and one a repository should not have to answer
 * twice. `name` (§4.2) is what to call the thing measured, which beats a directory name. And
 * `extensions.scoria` (§4.7) is the sanctioned place for a tool's own settings.
 *
 * `color` is deliberately not read. scoria's badge colour is the direction of travel since the
 * baseline; taking it from the repository would let a repository paint its own regression green.
 */

export const REPO_JSON = "repo.json";

export interface ProjectEntry {
  readonly path: string;
  /** §9.2: an entry naming many directories cannot name them, so a wildcard entry has none. */
  readonly name: string | undefined;
}

export interface RepoJson {
  readonly name: string | undefined;
  readonly projects: readonly ProjectEntry[];
  readonly extensions: Readonly<Record<string, unknown>>;
}

const EMPTY: RepoJson = { name: undefined, projects: [], extensions: {} };

const stringOr = (value: unknown): string | undefined => (typeof value === "string" && value !== "" ? value : undefined);

/** §9.1: a string entry is shorthand for an object carrying only `path`. */
const pathOf = (value: unknown): string | undefined => {
  if (typeof value === "string") return stringOr(value);
  return isRecord(value) ? stringOr(value["path"]) : undefined;
};

const toEntry = (value: unknown): ProjectEntry | undefined => {
  const path = pathOf(value);
  if (path === undefined) return undefined;
  // §9.2: a consumer MUST ignore the identity fields of a wildcard entry, keeping the path.
  const named = isRecord(value) && !path.includes("*") ? stringOr(value["name"]) : undefined;
  return { path, name: named };
};

/** §9.1 and §5: a string is shorthand for a one-entry array. */
const entriesOf = (value: unknown): readonly unknown[] => {
  if (typeof value === "string") return [value];
  return Array.isArray(value) ? value : [];
};

const toProjects = (value: unknown): readonly ProjectEntry[] => {
  const entries = entriesOf(value);
  return entries.flatMap((entry: unknown) => {
    const parsed = toEntry(entry);
    return parsed === undefined ? [] : [parsed];
  });
};

/** §4.7: every value under `extensions` must be an object; an entry that is not one is ignored. */
const toExtensions = (value: unknown): Readonly<Record<string, unknown>> => {
  if (!isRecord(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => isRecord(entry)));
};

/**
 * §3.1: a consumer MUST NOT search parent directories. A subdirectory without its own `repo.json`
 * has none — which is what makes a missing file mean "nothing declared" rather than "look upward".
 */
export const readRepoJson = async (root: string): Promise<RepoJson> => {
  try {
    const parsed: unknown = JSON.parse(await readFile(join(root, REPO_JSON), "utf8"));
    if (!isRecord(parsed)) return EMPTY;
    return { name: stringOr(parsed["name"]), projects: toProjects(parsed["projects"]), extensions: toExtensions(parsed["extensions"]) };
  } catch {
    return EMPTY;
  }
};

/**
 * §10.1: a project's name comes from its own `repo.json` first, then the parent's inline entry, and
 * is never inherited from the parent document — five packages all called "acme platform" is worse
 * than five called by their directories.
 */
export const nameFor = (own: RepoJson, parent: RepoJson, relativePath: string): string | undefined =>
  own.name ?? parent.projects.find((entry) => entry.path === relativePath)?.name;
