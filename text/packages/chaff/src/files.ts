import { globSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const MARKDOWN = [".md", ".markdown", ".mdx"];

/** 走査から外す。ここを通すと node_modules の README を延々と検査することになる。 */
const SKIP = ["node_modules", "dist", "build", "coverage", ".git", ".chaff-cache"];

const isMarkdown = (path: string): boolean => MARKDOWN.some((ext) => path.toLowerCase().endsWith(ext));

const isSkipped = (path: string): boolean => path.split(sep).some((part) => SKIP.includes(part));

const expand = (target: string): string[] => {
  const stat = statSync(target, { throwIfNoEntry: false });
  if (stat === undefined) return globSync(target).filter(isMarkdown);
  if (stat.isFile()) return [target];
  return globSync(join(target, "**", "*.{md,markdown,mdx}"));
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

export const collectTargets = (targets: readonly string[]): string[] => {
  const found = targets.flatMap(expand).filter((path) => !isSkipped(path));
  return [...new Set(found)].sort((left, right) => byPath(relative(".", left), relative(".", right)));
};
