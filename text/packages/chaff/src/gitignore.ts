import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import ignore, { type Ignore } from "ignore";

/** The rules of the .gitignore in one folder (relative to the project root, POSIX, "" for the root), or undefined when it has none. */
export type IgnoreAt = (folder: string) => Ignore | undefined;

/** Reads one .gitignore's text into the matcher git's own semantics need: negation, a trailing slash for folders only, anchoring. */
export const ignoreOf = (text: string): Ignore => ignore().add(text);

const folderChain = (parts: readonly string[]): string[] => parts.map((_part, index) => parts.slice(0, index).join("/"));

const below = (folder: string, path: string): string => (folder === "" ? path : path.slice(folder.length + 1));

/** What the .gitignore files from the root down to `path`'s folder say of it: a deeper file overrides a shallower one, as in git. */
const verdict = (path: string, isFolder: boolean, ignoreAt: IgnoreAt): boolean =>
  folderChain(path.split("/")).reduce((ignored, folder) => {
    const rules = ignoreAt(folder);
    if (rules === undefined) return ignored;
    const result = rules.test(`${below(folder, path)}${isFolder ? "/" : ""}`);
    if (result.ignored) return true;
    return result.unignored ? false : ignored;
  }, false);

/**
 * Pure: whether git would ignore the file at `path` (relative to the project root, POSIX). A file inside an ignored
 * folder stays ignored whatever a later `!` says, as in git: git never looks inside a folder it ignores.
 */
export const isGitIgnored = (path: string, ignoreAt: IgnoreAt): boolean => {
  const parts = path.split("/");
  const folders = parts.slice(1).map((_part, index) => parts.slice(0, index + 1).join("/"));
  return folders.some((folder) => verdict(folder, true, ignoreAt)) || verdict(path, false, ignoreAt);
};

/** What is at a path: a folder, a file, or nothing. Injected, so the search for the project root stays pure. */
export type KindAt = (path: string) => "folder" | "file" | undefined;

/** The folder whose ignore files apply, and whether its `.git` is a folder (a worktree's `.git` is a file). */
export type ProjectRoot = { readonly root: string; readonly gitFolder: boolean };

const isWithin = (folder: string, path: string): boolean => {
  const rel = relative(folder, path);
  return !rel.startsWith("..") && !isAbsolute(rel);
};

const repositoryAbove = (start: string, kindAt: KindAt): ProjectRoot | undefined => {
  const kind = kindAt(join(start, ".git"));
  if (kind !== undefined) return { root: start, gitFolder: kind === "folder" };
  const parent = dirname(start);
  return parent === start ? undefined : repositoryAbove(parent, kindAt);
};

/**
 * Pure: where ignore files are read from for a checked folder. The nearest folder at or above it holding `.git`, as git,
 * ripgrep and most linters do; without one, chaff.yaml's folder when it holds the checked folder; else the checked folder.
 */
export const projectRootOf = (checked: string, kindAt: KindAt, configFolder: string | undefined): ProjectRoot => {
  const start = resolve(checked);
  const found = repositoryAbove(start, kindAt);
  if (found !== undefined) return found;
  if (configFolder !== undefined && isWithin(resolve(configFolder), start)) return { root: resolve(configFolder), gitFolder: false };
  return { root: start, gitFolder: false };
};

/** Reads a text file, or undefined when it is not there or cannot be read. Injected. */
export type ReadText = (path: string) => string | undefined;

/**
 * Pure: each folder's ignore rules under the project root, read once per folder. At the root, `.git/info/exclude`
 * comes first and the root `.gitignore` after it, so the `.gitignore` wins where they disagree, as in git.
 */
export const ignoreLayers = (project: ProjectRoot, readText: ReadText): IgnoreAt => {
  const cache = new Map<string, Ignore | undefined>();
  const read = (folder: string): Ignore | undefined => {
    const own = readText(join(project.root, ...folder.split("/").filter((part) => part !== ""), ".gitignore"));
    const exclude = folder === "" && project.gitFolder ? readText(join(project.root, ".git", "info", "exclude")) : undefined;
    const texts = [exclude, own].filter((text): text is string => text !== undefined);
    return texts.length === 0 ? undefined : ignoreOf(texts.join("\n"));
  };
  return (folder) => {
    if (!cache.has(folder)) cache.set(folder, read(folder));
    return cache.get(folder);
  };
};
