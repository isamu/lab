import { readFile } from "node:fs/promises";
import { loadAdapter } from "../adapter-load.ts";
import { applyByPath } from "../config/by-path.ts";
import { profileFor } from "../profile/for-file.ts";
import { guessLanguage } from "../detect.ts";
import { isMarkdownPath } from "../structure/markdown-path.ts";
import { buildStructure } from "../structure/of.ts";
import { toSexp } from "../structure/sexp.ts";
import type { Config } from "../config/load.ts";
import type { StructureNode } from "../plugin.ts";
import type { Texts, UiLanguage } from "../ui.ts";

export type TreeContext = {
  readonly config: Config;
  readonly flag: (argv: readonly string[], name: string) => string | undefined;
  /** The language chaff speaks in here. Japanese when left out. */
  readonly ui?: UiLanguage;
};

const TEXT: Texts<{
  readonly usage: string;
  readonly unreadable: (path: string, why: string) => string;
  readonly noStructure: (path: string, language: string) => string;
}> = {
  ja: {
    usage: "使い方: chaff tree <file>... [--format sexp|json] [--language ja|en|…]",
    unreadable: (path, why) => `${path} を読めませんでした: ${why}`,
    noStructure: (path, language) => `${path}: 言語 ${language} のパッケージは文書の構造を読めません（structure がありません）`,
  },
  en: {
    usage: "usage: chaff tree <file>... [--format sexp|json] [--language ja|en|…]",
    unreadable: (path, why) => `Could not read ${path}: ${why}`,
    noStructure: (path, language) => `${path}: the ${language} package cannot read a document's structure (it has no structure)`,
  },
};

export const treeText = (context: TreeContext): (typeof TEXT)["ja"] => TEXT[context.ui ?? "ja"];

const FORMATS = ["sexp", "json"];

/** 値を取るフラグ。その次の引数は値で、対象のファイルではない。 */
const VALUED = ["--format", "--language"];

export const treeTargets = (argv: readonly string[]): string[] =>
  argv.slice(1).filter((arg, index, all) => !arg.startsWith("--") && !VALUED.includes(all[index - 1] ?? ""));

export const readSource = async (path: string, context: TreeContext): Promise<string | undefined> => {
  try {
    return await readFile(path, "utf8");
  } catch (err) {
    console.error(treeText(context).unreadable(path, err instanceof Error ? err.message : String(err)));
    return undefined;
  }
};

/**
 * 言語の決め方は lint / test / eval と同じ。そのファイルの by_path、全体の language、中身からの推定の順で、
 * その前に --language を置く。混在するリポジトリで、英語の契約書を日本語として読まないため。
 */
export const treeLanguage = (path: string, source: string, argv: readonly string[], context: TreeContext): string =>
  context.flag(argv, "--language") ??
  applyByPath(context.config.byPath, context.config.baseDir, path).language ??
  context.config.language ??
  guessLanguage(source).language;

export type SourceTree = { readonly source: string; readonly tree: StructureNode };

/**
 * 1 ファイルを読んで木にする。読めない・言語パッケージが構造を読めないときは、黙らずに言って undefined を返す。
 * chaff tree と chaff cite が同じ木を見るように、ここを一つにしておく。
 */
export const readTree = async (path: string, argv: readonly string[], context: TreeContext): Promise<SourceTree | undefined> => {
  const source = await readSource(path, context);
  if (source === undefined) return undefined;
  const language = treeLanguage(path, source, argv, context);
  const adapter = await loadAdapter(language);
  if (adapter.structure === undefined) {
    console.error(treeText(context).noStructure(path, language));
    return undefined;
  }
  // 日本語は形態素で数量と日付を読む。解析器が無ければ単位の表で読むので、木は作れる。
  await adapter.prepare?.({ pos: true });
  const profile = profileFor(context.config, path, source, language);
  return { source, tree: buildStructure({ path, source, language, markdown: isMarkdownPath(path), profile }, adapter.structure) };
};

const printTree = async (path: string, argv: readonly string[], context: TreeContext): Promise<boolean> => {
  const read = await readTree(path, argv, context);
  if (read === undefined) return false;
  console.log(context.flag(argv, "--format") === "json" ? JSON.stringify(read.tree, null, 2) : toSexp(read.tree));
  return true;
};

/**
 * 1 つずつ、渡された順に処理する。前のファイルが終わってから次を始めるので、出力の順が入れ替わらない。
 * 失敗したファイルがあっても残りは処理し、1 つでも失敗していれば false を返す。
 */
export const inOrder = async (paths: readonly string[], each: (path: string) => Promise<boolean>): Promise<boolean> =>
  paths.reduce<Promise<boolean>>(async (previous, path) => {
    const earlier = await previous;
    return (await each(path)) && earlier;
  }, Promise.resolve(true));

/**
 * 文書を番地の付いた木にして出す。S 式は人と AI が読むため、JSON は機械が読むため。
 * 書き換えはしない。Markdown でない .txt（見出しの無い契約書）も、行頭の番号で木にする。
 */
export const runTree = async (paths: readonly string[], argv: readonly string[], context: TreeContext): Promise<number> => {
  const format = context.flag(argv, "--format") ?? "sexp";
  if (paths.length === 0 || !FORMATS.includes(format)) {
    console.error(treeText(context).usage);
    return 1;
  }
  const printed = await inOrder(paths, (path) => printTree(path, argv, context));
  return printed ? 0 : 1;
};
