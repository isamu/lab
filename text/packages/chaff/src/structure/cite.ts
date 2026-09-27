import type { StructureNode } from "../plugin.ts";
import { lineStarts, placeOf } from "../position.ts";

// 回答の引用が原文にあるか。番地が木にあり、引用した文がその番地の範囲に書かれていれば一致。
// 意味が合っているかは見ない。書いてあるかどうかだけを、機械で決める。

export type Citation = { readonly address: string; readonly quote: string };

export type CitationStatus = "ok" | "missing-address" | "quote-elsewhere" | "quote-not-found";

export type CitationResult = {
  readonly citation: Citation;
  readonly status: CitationStatus;
  /** 引用文が原文で見つかった位置の、いちばん内側の番地。quote-elsewhere のとき、本当はどこに書いてあるか。 */
  readonly foundAt?: string;
  /** 引用文が見つかった行。 */
  readonly line?: number;
};

/** 比べる形。空白と改行を除き、全角と半角を NFKC で揃える。index は元の文字列での位置。 */
type Normalized = { readonly text: string; readonly index: readonly number[] };

const WHITESPACE = /\s/u;

const normalize = (source: string, from = 0, to = source.length): Normalized => {
  const text: string[] = [];
  const index: number[] = [];
  for (let at = from; at < to; at += 1) {
    const char = source[at] ?? "";
    if (WHITESPACE.test(char)) continue;
    // NFKC は 1 文字を複数にすることがある（「㈱」→「(株)」）。どれも元の同じ位置を指す。
    [...char.normalize("NFKC")].forEach((part) => {
      text.push(part);
      index.push(at);
    });
  }
  return { text: text.join(""), index };
};

const quoteKey = (quote: string): string => normalize(quote).text;

type Addressed = { readonly node: StructureNode; readonly depth: number };

/** 番地を持つ節点と、その深さ。深いほど内側。 */
const addressedNodes = (tree: StructureNode): Addressed[] => {
  const found: Addressed[] = [];
  const pending: Addressed[] = [{ node: tree, depth: 0 }];
  while (pending.length > 0) {
    const current = pending.pop();
    if (current === undefined) break;
    if (current.node.address !== "") found.push(current);
    [...current.node.children].reverse().forEach((child) => pending.push({ node: child, depth: current.depth + 1 }));
  }
  return found;
};

/** offset を含む、いちばん内側の番地。どの番地にも入らなければ undefined。 */
const innermostAt = (nodes: readonly Addressed[], offset: number): string | undefined =>
  nodes
    .filter(({ node }) => node.span.start <= offset && offset < node.span.end)
    .reduce<Addressed | undefined>((best, current) => (best === undefined || current.depth > best.depth ? current : best), undefined)?.node.address;

/**
 * 引用を一件ずつ確かめる。source は木を作った原文そのもの。
 * 引用文が空（空白だけ）なら、空の文字列はどの範囲にも含まれるので、番地だけを確かめることになる。
 */
export const checkCitations = (source: string, tree: StructureNode, citations: readonly Citation[]): CitationResult[] => {
  const nodes = addressedNodes(tree);
  const byAddress = new Map(nodes.map(({ node }) => [node.address, node]));
  const whole = normalize(source);
  return citations.map((citation): CitationResult => {
    const node = byAddress.get(citation.address);
    if (node === undefined) return { citation, status: "missing-address" };
    const key = quoteKey(citation.quote);
    if (normalize(source, node.span.start, node.span.end).text.includes(key)) return { citation, status: "ok", line: node.line };
    const at = whole.text.indexOf(key);
    const offset = at === -1 ? undefined : whole.index[at];
    if (offset === undefined) return { citation, status: "quote-not-found" };
    const foundAt = innermostAt(nodes, offset);
    const line = placeOf(lineStarts(source), offset).line;
    return { citation, status: "quote-elsewhere", line, ...(foundAt === undefined ? {} : { foundAt }) };
  });
};
