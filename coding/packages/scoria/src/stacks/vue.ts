import type { FileKind, StackAdapter, StackDetection } from "../plugin.ts";
import { readPackageJson, hasDependency } from "../package-json.ts";
import { basenameOf, isIgnoredPath, isTestPath } from "./paths.ts";

const SCRIPT_OPEN = /<script\b[^>]*>/i;
const SCRIPT_CLOSE = /<\/script\s*>/i;

const classify = (relativePath: string): FileKind => {
  if (isIgnoredPath(relativePath) || !relativePath.endsWith(".vue")) return "ignored";
  return isTestPath(relativePath) ? "test" : "source";
};

const blank = (text: string): string => " ".repeat(text.length);

/**
 * Keeps only the contents of `<script>` in a single-file component.
 *
 * Scanning a `<template>` as JavaScript makes HTML attribute quotes and apostrophes in body text
 * open string literals, hiding the code that follows; `<style>` has the same problem.
 * Removed regions become spaces of equal length so line numbers survive.
 */
export const scriptLinesOnly = (lines: readonly string[]): readonly string[] => {
  // Walking lines to track whether we are inside `<script>`, so only this flag is reassigned.
  let inScript = false;
  return lines.map((line) => {
    const open = SCRIPT_OPEN.exec(line);
    const close = SCRIPT_CLOSE.exec(line);
    if (!inScript && open !== null) {
      const from = open.index + open[0].length;
      const to = close === null ? line.length : close.index;
      inScript = close === null;
      return blank(line.slice(0, from)) + line.slice(from, to) + blank(line.slice(to));
    }
    if (inScript && close !== null) {
      inScript = false;
      return line.slice(0, close.index) + blank(line.slice(close.index));
    }
    return inScript ? line : blank(line);
  });
};

const detect = async (root: string): Promise<StackDetection> => {
  const pkg = await readPackageJson(root);
  const evidence = ["vue", "nuxt"].filter((name) => hasDependency(pkg, name)).map((name) => `dependencies.${name}`);
  return { matched: evidence.length > 0, confidence: evidence.length > 0 ? 1 : 0, evidence };
};

export const stackVue: StackAdapter = {
  kind: "stack",
  id: "vue",
  apiVersion: 1,
  detect,
  classify,
  codeLinesOf: scriptLinesOnly,
};

export const vueBasename = basenameOf;
