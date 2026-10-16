import type { Span, StructureNode } from "../plugin.ts";
import type { StructureIssue } from "./issues.ts";
import { isVersionHistory } from "./version-order.ts";

type Placed = { readonly node: StructureNode; readonly parent: StructureNode; readonly ordinal: number };

const labelOf = (node: StructureNode): string => String(node.attrs["label"] ?? node.address);

/** 「4.1」「4．1」の、最後の番号より前（「4」）。点で区切った番号でなければ無い。 */
const DOTTED = /^(.*\d)[.．](\d+)$/u;
const dottedPrefixOf = (label: string): string | undefined => DOTTED.exec(label.normalize("NFKC").trim())?.[1];

const OPENING_BRACKET = /^[([{〔【〈《]/u;

/**
 * 番号の並びの単位。点で区切った番号（4.1、4.3）は、前の番号（4）が同じものどうしを、親が違っても一つの並びに読む。
 * 番号の無い見出し（## Approved Office Supplies List）が間に入ると、4.3 は 4.1 と別の親の下に入るが、読み手には 4 の続きに見える。
 * それ以外の番号（第3条、(a)）は、同じ親の子どうしだけを並べる。
 */
const familyOf = (placed: Placed, parentIds: ReadonlyMap<StructureNode, number>): string => {
  const label = labelOf(placed.node);
  const shape = `${placed.node.kind}/${String(placed.node.level ?? "")}/${OPENING_BRACKET.test(label.normalize("NFKC")) ? "bracketed" : "bare"}`;
  const prefix = dottedPrefixOf(label);
  return prefix === undefined ? `${shape}/parent:${String(parentIds.get(placed.parent))}` : `${shape}/dotted:${prefix}`;
};

const placedNodes = (tree: StructureNode, quoting: ReadonlySet<StructureNode>): Placed[] => {
  const placed: Placed[] = [];
  const pending: StructureNode[] = [tree];
  for (let parent = pending.pop(); parent !== undefined; parent = pending.pop()) {
    parent.children.forEach((node) => {
      pending.push(node);
      if (node.ordinal !== undefined && node.ordinalTo === undefined && !quoting.has(node)) placed.push({ node, parent, ordinal: node.ordinal });
    });
  }
  return placed.toSorted((left, right) => left.node.span.start - right.node.span.start);
};

const familiesOf = (placed: readonly Placed[]): Placed[][] => {
  const parentIds = new Map<StructureNode, number>();
  placed.forEach(({ parent }) => parentIds.set(parent, parentIds.get(parent) ?? parentIds.size));
  const families = new Map<string, Placed[]>();
  placed.forEach((entry) => {
    const key = familyOf(entry, parentIds);
    const family = families.get(key) ?? [];
    family.push(entry);
    families.set(key, family);
  });
  return [...families.values()];
};

/** 番号の最後の数字を一つ進めた書き方（4.1 → 4.2、Section 2 → Section 3）。数字で書いていなければ、進めた番号だけ。 */
export const nextLabelOf = (label: string, ordinal: number): string => {
  const normalized = label.normalize("NFKC");
  const digits = [...normalized.matchAll(/\d+/gu)].at(-1);
  if (digits === undefined || Number(digits[0]) !== ordinal) return String(ordinal + 1);
  return `${normalized.slice(0, digits.index)}${String(ordinal + 1)}${normalized.slice(digits.index + digits[0].length)}`;
};

/** explains は、この誤りで説明がつく、並びの指摘の位置（二つ目、同じ親の下なら次の番号）。 */
export type RepeatedNumber = { readonly explains: readonly number[]; readonly between: Span; readonly issue: StructureIssue };

const repeatsIn = (family: readonly Placed[]): RepeatedNumber[] =>
  family.flatMap((first, index) => {
    const second = family[index + 1];
    const next = family[index + 2];
    if (second === undefined || next === undefined || second.parent !== first.parent) return [];
    if (second.ordinal !== first.ordinal || next.ordinal !== first.ordinal + 2) return [];
    const label = labelOf(second.node);
    return [
      {
        between: { start: second.node.span.start, end: next.node.span.start },
        explains: next.parent === second.parent ? [second.node.span.start, next.node.span.start] : [second.node.span.start],
        issue: {
          offset: second.node.span.start,
          variant: "repeated",
          values: { previous: labelOf(first.node), label, expected: first.ordinal + 1, found: second.ordinal, probably: nextLabelOf(label, second.ordinal) },
        },
      },
    ];
  });

/**
 * 同じ番号が二度続き、その次が一つ飛ぶ（4.1、4.1、4.3）。二つ目は、振り間違えた 4.2 である見込みが高い。
 * 重なりと抜けの二つに見えるが、誤りは一つなので、二つ目の番号で一度だけ言う。
 * 同じ親の下で隣り合う二つが同じ番号のときだけ。変更履歴の版の見出し（## 3.1.0）は番号の並びではないので見ない。
 * 別の部の 1.1 から振り直した並び（1.1、1.2 の後の 1.1、1.2）は、次が飛ばないので言わない。
 */
export const repeatedNumbers = (tree: StructureNode, quoting: ReadonlySet<StructureNode>): RepeatedNumber[] =>
  familiesOf(placedNodes(tree, quoting))
    .filter((family) => !isVersionHistory(family.map(({ node }) => labelOf(node))))
    .flatMap(repeatsIn);

/**
 * 並びの抜けと重なり（issues）のうち、同じ番号が二度続いたもの（repeatedNumbers）で説明がつくものを、その一つにまとめる。
 * 二つ目と次の番号のあいだに読めなかった範囲（unread）があれば、飛んだ番号はそこにあるかもしれないので、まとめずに元の指摘を残す。
 * 二つ目の番号への指摘は置き換え、次の番号への抜けの指摘は、二つ目と同じ親の下にあるときだけ（二つ目の次として数えたもの）消す。
 */
export const withRepeatsNamed = (
  tree: StructureNode,
  quoting: ReadonlySet<StructureNode>,
  issues: readonly StructureIssue[],
  unread: readonly Span[] = [],
): StructureIssue[] => {
  const repeats = repeatedNumbers(tree, quoting).filter(({ between }) => !unread.some((span) => span.start > between.start && span.start < between.end));
  const explained = new Set(repeats.flatMap(({ explains }) => explains));
  return [...issues.filter((issue) => !explained.has(issue.offset)), ...repeats.map(({ issue }) => issue)].toSorted(
    (left, right) => left.offset - right.offset,
  );
};
