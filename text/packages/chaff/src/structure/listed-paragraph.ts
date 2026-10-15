import type { StructureNode } from "../plugin.ts";

// 箇条書きで書いた項。規程は条の下の項を「1. 」「２．」の箇条書きで書くことがあり、木はそれを項として読まない。

/** 行頭の箇条書きの番号（「1. 」「２．」）。前の空白（全角も）を飛ばし、全角の数字と点も読む。 */
const LIST_MARK = /^[ \t\u3000]*(?<n>[0-9０-９]{1,3})[.．]/u;

/** 本文の行頭に箇条書きで書かれた番号。全角は半角の数にする（「２．」は 2）。Pure. */
export const listedNumbers = (body: string): ReadonlySet<number> =>
  new Set(
    body.split("\n").flatMap((line) => {
      const written = LIST_MARK.exec(line)?.groups?.["n"];
      return written === undefined ? [] : [Number(written.normalize("NFKC"))];
    }),
  );

/** 「3.3」を条の番地「3」と項の番号 3 に分ける。項の先まで指す（3.3.1）か、項が数でなければ undefined。Pure. */
export const articleParagraph = (target: string): { readonly article: string; readonly paragraph: number } | undefined => {
  const parts = target.split(".");
  const [article, paragraph] = parts;
  if (parts.length !== 2 || article === undefined || paragraph === undefined || !/^\d{1,3}$/u.test(paragraph)) return undefined;
  return { article, paragraph: Number(paragraph) };
};

/**
 * 木が項を一つも読まなかった条ごとの、箇条書きの番号。条の本文は一度だけ読む。同じ番地の条が二つあれば、どちらかに書いてあればよい。
 * nodes は木を平らにしたもの。Pure.
 */
export const listedParagraphsByArticle = (nodes: readonly StructureNode[], source: string): ReadonlyMap<string, ReadonlySet<number>> => {
  const byArticle = new Map<string, Set<number>>();
  nodes
    .filter((node) => node.kind === "article" && !node.children.some((child) => child.kind === "item"))
    .forEach((article) => {
      const numbers = byArticle.get(article.address) ?? new Set<number>();
      listedNumbers(source.slice(article.span.start, article.span.end)).forEach((number) => numbers.add(number));
      byArticle.set(article.address, numbers);
    });
  return byArticle;
};

/** 参照（第3条第3項）の項を、その条の箇条書きが書いているか。Pure. */
export const isListedParagraph = (target: string, listed: ReadonlyMap<string, ReadonlySet<number>>): boolean => {
  const wanted = articleParagraph(target);
  return wanted !== undefined && listed.get(wanted.article)?.has(wanted.paragraph) === true;
};
