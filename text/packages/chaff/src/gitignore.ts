import ignore, { type Ignore } from "ignore";

/** The rules of the .gitignore in one folder (relative to the checked root, POSIX, "" for the root), or undefined when it has none. */
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
 * Pure: whether git would ignore the file at `path` (relative to the checked root, POSIX). A file inside an ignored
 * folder stays ignored whatever a later `!` says, as in git: git never looks inside a folder it ignores.
 */
export const isGitIgnored = (path: string, ignoreAt: IgnoreAt): boolean => {
  const parts = path.split("/");
  const folders = parts.slice(1).map((_part, index) => parts.slice(0, index + 1).join("/"));
  return folders.some((folder) => verdict(folder, true, ignoreAt)) || verdict(path, false, ignoreAt);
};
