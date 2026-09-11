import { access, readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { ConfigFile } from "./plugin.ts";

/**
 * The configuration that decides what a project's own gates actually check.
 *
 * scoria measures a project against its own standards (spec §3.2), so the standards themselves
 * have to be read. The list is fixed rather than discovered: a probe that could go looking for
 * files would be a probe that can reach outside what the core classified.
 */

const WORKFLOW_DIRECTORY = ".github/workflows";
const MAX_BYTES = 512_000;
const MAX_CLIMB = 4;

const KNOWN_FILES = [
  "package.json",
  "tsconfig.json",
  "tsconfig.base.json",
  "jsconfig.json",
  "eslint.config.js",
  "eslint.config.mjs",
  "eslint.config.cjs",
  "eslint.config.ts",
  ".eslintrc",
  ".eslintrc.js",
  ".eslintrc.json",
  ".eslintrc.yml",
  ".eslintrc.yaml",
  ".eslintrc.cjs",
  ".prettierrc",
  ".prettierrc.json",
  ".prettierrc.js",
  "prettier.config.js",
  ".gitignore",
  "knip.json",
  "vitest.config.ts",
  "jest.config.js",
];

const readIfPresent = async (root: string, relativePath: string): Promise<ConfigFile | undefined> => {
  try {
    const text = await readFile(join(root, relativePath), "utf8");
    return text.length > MAX_BYTES ? undefined : { path: relativePath, text };
  } catch {
    return undefined;
  }
};

const exists = async (path: string): Promise<boolean> =>
  access(path).then(
    () => true,
    () => false,
  );

/**
 * Workflows live at the repository root, which is not the target directory when the package sits
 * in a subdirectory of a monorepo. Reporting "no CI" for a repository that has CI one level up is
 * worse than not checking at all, so the search walks up to the git root.
 */
const workflowRoot = async (root: string): Promise<string> => {
  const climb = async (directory: string, remaining: number): Promise<string> => {
    if (await exists(join(directory, WORKFLOW_DIRECTORY))) return directory;
    const parent = dirname(directory);
    if (remaining === 0 || parent === directory) return root;
    return (await exists(join(directory, ".git"))) ? root : climb(parent, remaining - 1);
  };
  return climb(root, MAX_CLIMB);
};

const workflowFiles = async (root: string): Promise<readonly ConfigFile[]> => {
  const base = await workflowRoot(root);
  const names = await readdir(join(base, WORKFLOW_DIRECTORY)).catch(() => []);
  const wanted = names.filter((name) => name.endsWith(".yml") || name.endsWith(".yaml"));
  const loaded = await Promise.all(wanted.map((name) => readIfPresent(base, `${WORKFLOW_DIRECTORY}/${name}`)));
  return loaded.filter((file): file is ConfigFile => file !== undefined);
};

export const collectConfigFiles = async (root: string): Promise<readonly ConfigFile[]> => {
  const known = await Promise.all(KNOWN_FILES.map((name) => readIfPresent(root, name)));
  return [...known.filter((file): file is ConfigFile => file !== undefined), ...(await workflowFiles(root))];
};

export const findConfig = (files: readonly ConfigFile[], path: string): ConfigFile | undefined => files.find((file) => file.path === path);

export const workflowsOf = (files: readonly ConfigFile[]): readonly ConfigFile[] => files.filter((file) => file.path.startsWith(`${WORKFLOW_DIRECTORY}/`));
