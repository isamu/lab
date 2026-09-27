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

/** 比べる形。空白と改行を除き、全角と半角を NFKC で揃える。index は各文字の元の位置。 */
type Normalized = { readonly text: string; readonly index: readonly number[] };

const WHITESPACE = /^\s+$/u;
const GRAPHEMES = new Intl.Segmenter("und", { granularity: "grapheme" });

/**
 * 書記素（見た目の一文字）ごとに NFKC をかける。1 符号単位ずつでは「ｶﾞ」と「ガ」、「ハ」＋濁点と「バ」が揃わない。
 * NFKC は 1 文字を複数にすることがある（「㈱」→「(株)」）。どれも元の書記素の先頭を指す。
 */
const normalize = (source: string): Normalized => {
  const text: string[] = [];
  const index: number[] = [];
  [...GRAPHEMES.segment(source)].forEach(({ segment, index: at }) => {
    if (WHITESPACE.test(segment)) return;
    [...segment.normalize("NFKC")].forEach((part) => {
      text.push(part);
      index.push(at);
    });
  });
  return { text: text.join(""), index };
};

type Occurrence = { readonly start: number; readonly last: number };

/** key が現れる位置を全部、元の文字列の位置で。start は最初の文字、last は最後の文字の位置。 */
const occurrencesOf = (whole: Normalized, key: string): Occurrence[] => {
  // 空の key は indexOf がどこまでも位置を返し、終わらなくなる。
  if (key === "") return [];
  const found: Occurrence[] = [];
  for (let at = whole.text.indexOf(key); at !== -1; at = whole.text.indexOf(key, at + 1)) {
    found.push({ start: whole.index[at] ?? 0, last: whole.index[at + key.length - 1] ?? 0 });
  }
  return found;
};

const within = (node: StructureNode, occurrence: Occurrence): boolean => node.span.start <= occurrence.start && occurrence.last < node.span.end;

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

/** 引用の全体を含む、いちばん内側の番地。二つの項にまたがる引用なら、両方を含む条。どの番地にも入らなければ undefined。 */
const innermostHolding = (nodes: readonly Addressed[], occurrence: Occurrence): string | undefined =>
  nodes
    .filter(({ node }) => within(node, occurrence))
    .reduce<Addressed | undefined>((best, current) => (best === undefined || current.depth > best.depth ? current : best), undefined)?.node.address;

/**
 * 引用を一件ずつ確かめる。source は木を作った原文そのもの。
 * 引用文が空（空白だけ）なら番地だけを確かめる。同じ番地が二つある（附則が第1条から振り直す）ときは、どちらかにあれば一致。
 * 原文は一度だけ揃え、引用ごとには番地の範囲を揃え直さない。長い契約書に引用が何百とあっても、引用ごとの代金は原文の長さに比例するだけ。
 */
export const checkCitations = (source: string, tree: StructureNode, citations: readonly Citation[]): CitationResult[] => {
  const nodes = addressedNodes(tree);
  const byAddress = new Map<string, StructureNode[]>();
  nodes.forEach(({ node }) => {
    const same = byAddress.get(node.address) ?? [];
    same.push(node);
    byAddress.set(node.address, same);
  });
  const whole = normalize(source);
  const starts = lineStarts(source);
  return citations.map((citation): CitationResult => {
    const candidates = byAddress.get(citation.address) ?? [];
    const first = candidates[0];
    if (first === undefined) return { citation, status: "missing-address" };
    const key = normalize(citation.quote).text;
    if (key === "") return { citation, status: "ok", line: first.line };
    const occurrences = occurrencesOf(whole, key);
    const holder = candidates.find((node) => occurrences.some((occurrence) => within(node, occurrence)));
    if (holder !== undefined) return { citation, status: "ok", line: holder.line };
    const earliest = occurrences[0];
    if (earliest === undefined) return { citation, status: "quote-not-found" };
    const foundAt = innermostHolding(nodes, earliest);
    const line = placeOf(starts, earliest.start).line;
    return { citation, status: "quote-elsewhere", line, ...(foundAt === undefined ? {} : { foundAt }) };
  });
};
