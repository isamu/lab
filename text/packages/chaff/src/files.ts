import { globSync, readFileSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, matchesGlob, relative, sep } from "node:path";
import { matches } from "./config/by-path.ts";
import { ignoreLayers, isGitIgnored, projectRootOf, type IgnoreAt, type KindAt, type ProjectRoot, type ReadText } from "./gitignore.ts";
import { plainSource } from "./plain-source.ts";

/** 検査する文書を読む。言語・ジャンル・stet も文書モデルと同じ本文（BOM と CRLF / CR をそろえたもの）で読むため、ここでそろえる。 */
export const readDocumentFile = async (path: string): Promise<string> => plainSource(await readFile(path, "utf8"));

/** What a directory walk finds without include: Markdown. */
export const MARKDOWN = [".md", ".markdown", ".mdx"];

/** 走査から外す。ここを通すと node_modules の README を延々と検査することになる。 */
const SKIP: ReadonlySet<string> = new Set(["node_modules", "dist", "build", "coverage", ".git", ".chaff-cache"]);

const isMarkdown = (path: string): boolean => MARKDOWN.some((ext) => path.toLowerCase().endsWith(ext));

const isSkipped = (path: string): boolean => path.split(sep).some((part) => SKIP.has(part));

/** include: file-name globs (*.yaml) a walk takes besides Markdown. A glob with a slash is matched below each folder walked. */
const isIncluded = (path: string, include: readonly string[]): boolean => include.some((pattern) => matchesGlob(path, join("**", pattern)));

/** One target given on the command line, and what it found. A file named itself is always checked; what a walk or a glob found may be left out. */
type Found = { readonly paths: readonly string[]; readonly named: boolean; readonly root: string };

const GLOB_MAGIC = /[*?[{]/u;

/** The folder a glob walks from: its segments up to the first with a wildcard. */
const globRoot = (pattern: string): string => {
  const parts = pattern.split(/[\\/]/u);
  const fixed = parts.slice(
    0,
    Math.max(
      0,
      parts.findIndex((part) => GLOB_MAGIC.test(part)),
    ),
  );
  return fixed.length === 0 ? "." : fixed.join(sep);
};

const expand =
  (include: readonly string[]) =>
  (target: string): Found => {
    const stat = statSync(target, { throwIfNoEntry: false });
    if (stat === undefined) {
      return { paths: globSync(target).filter((path) => isMarkdown(path) || isIncluded(path, include)), named: false, root: globRoot(target) };
    }
    if (stat.isFile()) return { paths: [target], named: true, root: target };
    const patterns = [join(target, "**", "*.{md,markdown,mdx}"), ...include.map((pattern) => join(target, "**", pattern))];
    return { paths: patterns.flatMap((pattern) => globSync(pattern)), named: false, root: target };
  };

/** What chaff.yaml leaves out of a walk: `exclude:` globs, matched from the folder chaff.yaml is in, as by_path is. */
export type Exclusion = { readonly exclude?: readonly string[] | undefined; readonly baseDir: string; readonly path?: string | undefined };

/** Why files a walk found were not checked: how many `exclude:` in chaff.yaml left out, and how many a .gitignore did. */
export type Excluded = { readonly config: number; readonly gitignore: number };

const kindAt: KindAt = (path) => {
  const stat = statSync(path, { throwIfNoEntry: false });
  if (stat === undefined) return undefined;
  return stat.isDirectory() ? "folder" : "file";
};

/** A folder without an ignore file, or with one that cannot be read, has no rules. */
const readText: ReadText = (path) => {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return undefined;
  }
};

/** Where a target's ignore files are read from: its repository's root, else chaff.yaml's folder, else the target itself. */
const projectOf = (found: Found, exclusion: Exclusion | undefined): ProjectRoot =>
  projectRootOf(found.root, kindAt, exclusion?.path === undefined ? undefined : exclusion.baseDir);

type Project = { readonly root: string; readonly ignoreAt: IgnoreAt };

type Reason = keyof Excluded | undefined;

const reasonOf = (path: string, found: Found, exclusion: Exclusion | undefined, project: Project): Reason => {
  if (found.named) return undefined;
  if (exclusion?.exclude?.some((glob) => matches(glob, exclusion.baseDir, path)) === true) return "config";
  const below = relative(project.root, path).split(sep).join("/");
  return below.startsWith("..") || !isGitIgnored(below, project.ignoreAt) ? undefined : "gitignore";
};

/**
 * 与えられたファイル・ディレクトリ・glob を、検査する Markdown の一覧にする。
 * 0 件は成功にしない（§14）。glob が何にもマッチしないまま CI が緑になると、
 * 「通っているが何も検証していない」状態が延々と続く。
 */
/**
 * ロケールを明示する。既定のロケールに任せると、同じ入力でも機械によって順序が変わる。
 * 指摘の並びは CI のログにも baseline にも入るので、順序が揺れてはいけない。
 */
const byPath = (left: string, right: string): number => left.localeCompare(right, "en");

/** The files to check, and how many a walk found but left out, by reason. */
export type Collected = { readonly paths: readonly string[]; readonly excluded: Excluded };

export const collectFiles = (targets: readonly string[], include: readonly string[] = [], exclusion?: Exclusion): Collected => {
  const found = targets.map(expand(include));
  const judged = found.flatMap((entry) => {
    const root = projectOf(entry, exclusion);
    const project: Project = { root: root.root, ignoreAt: ignoreLayers(root, readText) };
    return entry.paths.filter((path) => !isSkipped(path)).map((path) => ({ path, reason: reasonOf(path, entry, exclusion, project) }));
  });
  const kept = new Set(judged.filter((entry) => entry.reason === undefined).map((entry) => entry.path));
  const left = new Map(
    judged.flatMap((entry): [string, keyof Excluded][] => (entry.reason === undefined || kept.has(entry.path) ? [] : [[entry.path, entry.reason]])),
  );
  const count = (reason: keyof Excluded): number => [...left.values()].filter((entry) => entry === reason).length;
  return {
    paths: [...kept].toSorted((one, other) => byPath(relative(".", one), relative(".", other))),
    excluded: { config: count("config"), gitignore: count("gitignore") },
  };
};

export const collectTargets = (targets: readonly string[], include: readonly string[] = [], exclusion?: Exclusion): string[] => [
  ...collectFiles(targets, include, exclusion).paths,
];
