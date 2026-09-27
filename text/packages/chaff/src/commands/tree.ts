import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { loadAdapter } from "../adapter-load.ts";
import { guessLanguage } from "../detect.ts";
import { buildStructure } from "../structure/build.ts";
import { toSexp } from "../structure/sexp.ts";
import type { Config } from "../config/load.ts";

export type TreeContext = {
  readonly config: Config;
  readonly flag: (argv: readonly string[], name: string) => string | undefined;
};

const MARKDOWN = [".md", ".markdown", ".mdx"];
const FORMATS = ["sexp", "json"];

const USAGE = "使い方: chaff tree <file>... [--format sexp|json] [--language ja|en|…]";

/** 値を取るフラグ。その次の引数は値で、対象のファイルではない。 */
const VALUED = ["--format", "--language"];

export const treeTargets = (argv: readonly string[]): string[] =>
  argv.slice(1).filter((arg, index, all) => !arg.startsWith("--") && !VALUED.includes(all[index - 1] ?? ""));

const readSource = async (path: string): Promise<string | undefined> => {
  try {
    return await readFile(path, "utf8");
  } catch (err) {
    console.error(`${path} を読めませんでした: ${err instanceof Error ? err.message : String(err)}`);
    return undefined;
  }
};

/** 1 ファイルを木にして出す。読めない・言語パッケージが構造を読めないときは、黙らずに言って失敗にする。 */
const printTree = async (path: string, argv: readonly string[], context: TreeContext): Promise<boolean> => {
  const source = await readSource(path);
  if (source === undefined) return false;
  const language = context.flag(argv, "--language") ?? context.config.language ?? guessLanguage(source).language;
  const adapter = await loadAdapter(language);
  if (adapter.structure === undefined) {
    console.error(`${path}: 言語 ${language} のパッケージは文書の構造を読めません（structure がありません）`);
    return false;
  }
  const tree = buildStructure({ path, source, language, markdown: MARKDOWN.includes(extname(path).toLowerCase()) }, adapter.structure);
  console.log(context.flag(argv, "--format") === "json" ? JSON.stringify(tree, null, 2) : toSexp(tree));
  return true;
};

/**
 * 文書を番地の付いた木にして出す。S 式は人と AI が読むため、JSON は機械が読むため。
 * 書き換えはしない。Markdown でない .txt（見出しの無い契約書）も、行頭の番号で木にする。
 */
export const runTree = async (paths: readonly string[], argv: readonly string[], context: TreeContext): Promise<number> => {
  const format = context.flag(argv, "--format") ?? "sexp";
  if (paths.length === 0 || !FORMATS.includes(format)) {
    console.error(USAGE);
    return 1;
  }
  const printed = await paths.reduce<Promise<boolean>>(async (all, path) => (await printTree(path, argv, context)) && (await all), Promise.resolve(true));
  return printed ? 0 : 1;
};
