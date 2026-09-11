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
 * SFC のうち `<script>` の中身だけを残す。
 *
 * `<template>` を JavaScript として走査すると、HTML 属性の引用符や本文のアポストロフィが
 * 文字列の開始と誤認され、その後ろのコードが隠れる。`<style>` も同じ。
 * 行番号を保つため、外した部分は同じ長さの空白にする。
 */
export const scriptLinesOnly = (lines: readonly string[]): readonly string[] => {
  // 行を順に見て `<script>` の内外を切り替えるので、状態だけ再代入する。
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
