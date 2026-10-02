import type { StructureNode } from "../plugin.ts";
import { inDocumentOrder } from "../structure/issues.ts";
import { lineNumberAt, linesOf, type Line } from "../structure/lines.ts";
import type { Fact } from "./labelled-facts.ts";
import { withoutEdgeMarks } from "./trim-marks.ts";

/**
 * 事実の居場所。同じ名前でも、違う見出しの下、違う親の項目の下、太字だけの行や「第2回：」のような小見出しの行の後ろは、
 * 別の催しや別の場合の値として比べない。scope が同じ事実どうしだけを比べる。
 * part は冒頭（最初の見出しより前）、要約の節（概要、Summary）、本文のどれか。
 */
export type FactPart = "opening" | "summary" | "body";

/** record: 同じ範囲で、行の頭に何度も書かれた名前。催しや論文ごとの記録の欄で、値が違っても食い違いではない。 */
export type ScopedFact = Fact & { readonly scope: string; readonly part: FactPart; readonly record: boolean };

const CONTAINERS: ReadonlySet<string> = new Set(["section", "chapter", "article"]);

const LIST_ITEM = /^([ \t]*)(?:[-*+]|\d{1,3}[.)])[ \t]/u;
/** 小見出しの代わりの行: 太字だけの行（項目でもよい）、コロンで終わる短い行。 */
const BOLD_LINE = /^[ \t]*(?:[-*+][ \t]+)?(?:\*\*|__)[^*_]+(?:\*\*|__)[:：]?[ \t]*$/u;
const COLON_LINE = /^[^|]{1,40}[:：][ \t]*$/u;

const covers = (node: StructureNode, offset: number): boolean => node.span.start <= offset && offset < node.span.end;

const containersAt = (nodes: readonly StructureNode[], offset: number): StructureNode[] => nodes.filter((node) => covers(node, offset));

const INDENT = /^[ \t]*/u;

const indentOf = (line: Line | undefined): number => INDENT.exec(line?.text ?? "")?.[0].length ?? 0;

/** 字下げの無い地の文の行。そこより上の項目は、もう別の並び。 */
const leavesList = (line: Line): boolean => line.text.trim() !== "" && indentOf(line) === 0 && !LIST_ITEM.test(line.text);

/**
 * 親の項目: 自分より浅い字下げで、上にある一番近い項目の行。項目の下に字下げして続けた行（項目の続き）も、その項目を親とする。
 * 字下げの無い行には無い。
 */
const parentItem = (lines: readonly Line[], index: number): number => {
  const indent = indentOf(lines[index]);
  if (indent === 0) return -1;
  for (let at = index - 1; at >= 0; at -= 1) {
    const line = lines[at];
    if (line === undefined || leavesList(line)) return -1;
    if (LIST_ITEM.test(line.text) && indentOf(line) < indent) return at;
  }
  return -1;
};

const MAX_HEAD_LABEL = 24;
const HEAD_MARK = /^[ \t>]*(?:[-*+][ \t]+)?/u;
/** 同じ範囲で、行の頭にこれだけ書かれた名前は、繰り返す記録の欄（一覧の Title:、Comments:）。 */
const RECORD_REPEATS = 3;

/** 行の頭の「名前：」の名前。比べる名前と同じ書き方に揃える。 */
const headLabelOf = (line: Line): string | undefined => {
  const text = line.text.replace(HEAD_MARK, "");
  const colon = text.search(/[:：|]/u);
  if (colon <= 0 || text.charAt(colon) === "|") return undefined;
  const label = withoutEdgeMarks(text.slice(0, colon));
  return label === "" || label.length > MAX_HEAD_LABEL ? undefined : label.normalize("NFKC").toLowerCase();
};

const isBreaker = (line: Line): boolean => BOLD_LINE.test(line.text) || (!LIST_ITEM.test(line.text) && COLON_LINE.test(line.text));

/** 行ごとに、それより前にある小見出しの代わりの行の数。節の始まりから事実の行までの数は、二つの差になる。 */
const breakerCounts = (lines: readonly Line[]): number[] =>
  lines.reduce<number[]>(
    (counts, line, index) => {
      counts.push((counts[index] ?? 0) + (isBreaker(line) ? 1 : 0));
      return counts;
    },
    [0],
  );

const lineIndexAt = (lines: readonly Line[], offset: number): number => (lineNumberAt(lines, offset) ?? 1) - 1;

const isSummaryHeading = (node: StructureNode, summaryWords: readonly string[]): boolean => {
  const heading = String(node.attrs["heading"] ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/^[\d.\s]+/u, "")
    .trim();
  return summaryWords.some((word) => heading === word.toLowerCase());
};

const TOP_LEVEL_HEADING = /^h\d+$/u;

/** 冒頭: 文書の頭か、表題の見出しの直下で、最初の小見出しより前。 */
const isOpening = (innermost: StructureNode | undefined, tree: StructureNode, offset: number): boolean => {
  const owner = innermost ?? tree;
  if (owner !== tree && !TOP_LEVEL_HEADING.test(owner.address)) return false;
  const firstChild = owner.children.find((child) => CONTAINERS.has(child.kind));
  return firstChild === undefined ? owner === tree : offset < firstChild.span.start;
};

const partOf = (around: readonly StructureNode[], tree: StructureNode, offset: number, summaryWords: readonly string[]): FactPart => {
  if (around.some((node) => node.kind === "section" && isSummaryHeading(node, summaryWords))) return "summary";
  return isOpening(around.at(-1), tree, offset) ? "opening" : "body";
};

/** 名前ごとに、頭にその名前を書いた行の番号。 */
const headLines = (lines: readonly Line[]): ReadonlyMap<string, readonly number[]> => {
  const found = new Map<string, number[]>();
  lines.forEach((line, index) => {
    const head = headLabelOf(line);
    if (head === undefined) return;
    const indexes = found.get(head);
    if (indexes === undefined) found.set(head, [index]);
    else indexes.push(index);
  });
  return found;
};

/** 範囲の行のうち、頭にその名前を書いた行の数。 */
const headCount = (heads: ReadonlyMap<string, readonly number[]>, from: number, to: number, key: string): number =>
  (heads.get(key) ?? []).filter((index) => index >= from && index < to).length;

type Lines = { readonly lines: readonly Line[]; readonly breakers: readonly number[]; readonly heads: ReadonlyMap<string, readonly number[]> };

const scopeOf = (fact: Fact, innermost: StructureNode | undefined, at: Lines): { scope: string; record: boolean } => {
  const index = lineIndexAt(at.lines, fact.value.start);
  const from = innermost === undefined ? 0 : lineIndexAt(at.lines, innermost.span.start);
  const to = innermost === undefined ? at.lines.length : lineIndexAt(at.lines, innermost.span.end - 1) + 1;
  const scope = [innermost?.address ?? "doc", (at.breakers[index] ?? 0) - (at.breakers[from] ?? 0), parentItem(at.lines, index)].join("#");
  return { scope, record: headCount(at.heads, from, to, fact.key) >= RECORD_REPEATS };
};

/** 事実ごとに、比べてよい範囲と、文書のどの部分かを付ける。 */
export const scopedFacts = (facts: readonly Fact[], tree: StructureNode, source: string, summaryWords: readonly string[]): ScopedFact[] => {
  if (facts.length === 0) return [];
  const nodes = inDocumentOrder(tree).filter((node) => CONTAINERS.has(node.kind));
  const lines = linesOf(source);
  const at: Lines = { lines, breakers: breakerCounts(lines), heads: headLines(lines) };
  return facts
    .toSorted((left, right) => left.value.start - right.value.start)
    .map((fact) => {
      const around = containersAt(nodes, fact.value.start);
      return { ...fact, ...scopeOf(fact, around.at(-1), at), part: partOf(around, tree, fact.value.start, summaryWords) };
    });
};
