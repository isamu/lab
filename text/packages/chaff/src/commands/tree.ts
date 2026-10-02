import { readDocumentFile } from "../files.ts";
import { loadAdapter } from "../adapter-load.ts";
import { profileFor } from "../profile/for-file.ts";
import { resolveGenre } from "../resolve-genre.ts";
import { documentLanguage } from "../check-source.ts";
import { isMarkdownPath } from "../structure/markdown-path.ts";
import { structureText } from "../document-reading.ts";
import { buildStructure } from "../structure/of.ts";
import { toSexp } from "../structure/sexp.ts";
import { foldPostOrder } from "../tree-walk.ts";
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
  readonly tooDeepForJson: (path: string, depth: number) => string;
}> = {
  ja: {
    usage: "使い方: chaff tree <file>... [--format sexp|json] [--language ja|en|…]",
    unreadable: (path, why) => `${path} を読めませんでした: ${why}`,
    noStructure: (path, language) => `${path}: 言語 ${language} のパッケージは文書の構造を読めません（structure がありません）`,
    tooDeepForJson: (path, depth) => `${path}: 木が ${String(depth)} 段と深すぎて、字下げした JSON に書き出せません（--format sexp なら書けることがあります）`,
  },
  en: {
    usage: "usage: chaff tree <file>... [--format sexp|json] [--language ja|en|…]",
    unreadable: (path, why) => `Could not read ${path}: ${why}`,
    noStructure: (path, language) => `${path}: the ${language} package cannot read a document's structure (it has no structure)`,
    tooDeepForJson: (path, depth) => `${path}: the tree is ${String(depth)} levels deep, too deep to write as indented JSON (--format sexp may still write it)`,
  },
};

const treeText = (context: TreeContext): (typeof TEXT)["ja"] => TEXT[context.ui ?? "ja"];

const FORMATS: ReadonlySet<string> = new Set(["sexp", "json"]);

/** 値を取るフラグ。その次の引数は値で、対象のファイルではない。 */
const VALUED: ReadonlySet<string> = new Set(["--format", "--language", "--genre"]);

export const treeTargets = (argv: readonly string[]): string[] =>
  argv.slice(1).filter((arg, index, all) => !arg.startsWith("--") && !VALUED.has(all[index - 1] ?? ""));

export const readSource = async (path: string, context: TreeContext): Promise<string | undefined> => {
  try {
    return await readDocumentFile(path);
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
  context.flag(argv, "--language") ?? documentLanguage(path, source, context.config);

export type SourceTree = { readonly source: string; readonly tree: StructureNode };

/** A text's tree of addresses, read as `chaff tree` reads a file; undefined when the language package cannot read structure. */
export const treeFromSource = async (path: string, source: string, language: string, genre: string, config: Config): Promise<StructureNode | undefined> => {
  const adapter = await loadAdapter(language);
  if (adapter.structure === undefined) return undefined;
  // 日本語は形態素で数量と日付を読む。解析器が無ければ単位の表で読むので、木は作れる。
  await adapter.prepare?.({ pos: true });
  const profile = profileFor(config, path, source, language, genre);
  return buildStructure({ path, source, language, markdown: isMarkdownPath(path), profile, lexicons: adapter.lexicons }, adapter.structure);
};

/**
 * 1 ファイルを読んで木にする。読めない・言語パッケージが構造を読めないときは、黙らずに言って undefined を返す。
 * chaff tree と chaff cite が同じ木を見るように、ここを一つにしておく。
 */
export const readTree = async (path: string, argv: readonly string[], context: TreeContext): Promise<SourceTree | undefined> => {
  const source = await readSource(path, context);
  if (source === undefined) return undefined;
  const language = treeLanguage(path, source, argv, context);
  const genre = resolveGenre(path, source, context.config, context.flag(argv, "--genre")).genre;
  // A YAML file's tree is read from its values alone, as a check reads it.
  const text = structureText(path, source);
  const tree = await treeFromSource(path, text, language, genre, context.config);
  if (tree === undefined) {
    console.error(treeText(context).noStructure(path, language));
    return undefined;
  }
  return { source: text, tree };
};

/**
 * 字下げした JSON。書けないほど深い木（言語パッケージの番号が何千段も入れ子になる）なら undefined。
 * JSON.stringify は 1 段ごとに呼び直すのでスタックが尽き、字下げの合計は深さの二乗で増えて文字列の上限を超える。どちらも RangeError になる。
 */
export const treeJson = (tree: StructureNode): string | undefined => {
  try {
    return JSON.stringify(tree, null, 2);
  } catch (err) {
    if (err instanceof RangeError) return undefined;
    throw err;
  }
};

/** 根を 1 段目と数えた、いちばん深い葉までの段の数。 */
export const depthOf = (tree: StructureNode): number =>
  foldPostOrder(
    tree,
    (node) => node.children,
    (_node, depths: readonly number[]) => depths.reduce((deepest, depth) => Math.max(deepest, depth), 0) + 1,
  );

/** 出力する文字列。JSON に書けないほど深い木なら、その深さ。 */
export const renderTree = (tree: StructureNode, format: string | undefined): { readonly text: string } | { readonly tooDeep: number } => {
  if (format !== "json") return { text: toSexp(tree) };
  const json = treeJson(tree);
  return json === undefined ? { tooDeep: depthOf(tree) } : { text: json };
};

const printTree = async (path: string, argv: readonly string[], context: TreeContext): Promise<boolean> => {
  const read = await readTree(path, argv, context);
  if (read === undefined) return false;
  const rendered = renderTree(read.tree, context.flag(argv, "--format"));
  if ("tooDeep" in rendered) {
    console.error(treeText(context).tooDeepForJson(path, rendered.tooDeep));
    return false;
  }
  console.log(rendered.text);
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
  if (paths.length === 0 || !FORMATS.has(format)) {
    console.error(treeText(context).usage);
    return 1;
  }
  const printed = await inOrder(paths, (path) => printTree(path, argv, context));
  return printed ? 0 : 1;
};
