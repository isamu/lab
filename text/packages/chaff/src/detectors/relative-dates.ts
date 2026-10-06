import type { Detector, Finding, ProseDocument, Span, StructureNode } from "../plugin.ts";
import { inDocumentOrder } from "../structure/issues.ts";
import { overlapsAny, spanIndex } from "../compare/spans.ts";
import type { DurationUnit } from "../derived/date-arithmetic.ts";
import { relativeMismatches, type DatedValue, type Relative } from "../derived/relative-dates.ts";
import { quoteAt } from "./structure-tree.ts";
import { dayWordFindings } from "./relative-day-words.ts";

/** 期間の単位の語彙表。relative-year-unit は、向きの語が付くときだけ期間になる単位（「1年前」の年）。 */
const DURATION_LEXICONS: readonly (readonly [string, DurationUnit])[] = [
  ["duration-day", "day"],
  ["duration-week", "week"],
  ["duration-month", "month"],
  ["duration-year", "year"],
  ["relative-year-unit", "year"],
];

type Amount = Span & { readonly amount: number; readonly unit: DurationUnit };

const patternsOf = (doc: ProseDocument, id: string): string[] => (doc.lexicons[id] ?? []).map((entry) => entry.pattern);

const unitOf = (doc: ProseDocument, written: string): DurationUnit | undefined => {
  const unit = written.normalize("NFKC").toLowerCase();
  return DURATION_LEXICONS.find(([id]) => patternsOf(doc, id).some((pattern) => pattern.normalize("NFKC").toLowerCase() === unit))?.[1];
};

/** 数のすぐ後ろ（空白一つまで）に書いた単位まで。木の数量は単位の前で終わることがある（3 days の 3）。 */
const endWithUnit = (source: string, end: number, unit: string): number => {
  const gap = source.charAt(end) === " " || source.charAt(end) === "\t" ? 1 : 0;
  return unit !== "" && source.startsWith(unit, end + gap) ? end + gap + unit.length : end;
};

const treeAmounts = (doc: ProseDocument, tree: StructureNode): Amount[] =>
  inDocumentOrder(tree).flatMap((node): Amount[] => {
    const written = String(node.attrs["unit"] ?? "");
    const unit = node.kind === "quantity" ? unitOf(doc, written) : undefined;
    if (unit === undefined) return [];
    return [{ start: node.span.start, end: endWithUnit(doc.source, node.span.end, written), amount: Number(node.attrs["value"]), unit }];
  });

/** 語で書いた数（two weeks）。count-number の語彙表は一から順に並ぶので、位置が数。 */
/** 数の語と、その後ろの単位の語。単位は先読みで読むので、語を二つずつ食べずに、どの語も数の語として試せる。 */
const WORD_AMOUNT = /(?<![\p{L}\p{N}])(\p{L}+)(?=([ \t]+)(\p{L}+)(?![\p{L}\p{N}]))/gu;

const wordAmounts = (doc: ProseDocument, taken: readonly Span[]): Amount[] => {
  const numbers = patternsOf(doc, "count-number").map((word) => word.toLowerCase());
  const index = spanIndex(taken);
  return [...doc.source.matchAll(WORD_AMOUNT)].flatMap((match): Amount[] => {
    const position = numbers.indexOf((match[1] ?? "").toLowerCase());
    const unit = unitOf(doc, match[3] ?? "");
    const span = { start: match.index, end: match.index + (match[1] ?? "").length + (match[2] ?? "").length + (match[3] ?? "").length };
    return position === -1 || unit === undefined || overlapsAny(index, span) ? [] : [{ ...span, amount: position + 1, unit }];
  });
};

const LATIN = /^[a-z ]+$/iu;
const WORD_CHAR = /[\p{L}\p{N}]/u;

/** 期間のすぐ後ろの、向きの語（後、later）。英字の語は空白を挟んで、語の切れ目まで。 */
const directionOf = (doc: ProseDocument, amount: Amount): 1 | -1 | undefined => {
  const after = doc.source.slice(amount.end, amount.end + 20).toLowerCase();
  const matches = (word: string): boolean => {
    const lower = word.toLowerCase();
    if (!LATIN.test(word)) return after.startsWith(lower);
    return after.startsWith(` ${lower}`) && !WORD_CHAR.test(after.charAt(lower.length + 1));
  };
  if (patternsOf(doc, "relative-after").some(matches)) return 1;
  return patternsOf(doc, "relative-before").some(matches) ? -1 : undefined;
};

/** 向きの語まで含めた相対の期間。 */
const relativesOf = (doc: ProseDocument, amounts: readonly Amount[]): Relative[] =>
  amounts.flatMap((amount): Relative[] => {
    const direction = directionOf(doc, amount);
    if (direction === undefined) return [];
    const words = patternsOf(doc, direction === 1 ? "relative-after" : "relative-before");
    const after = doc.source.slice(amount.end).toLowerCase();
    const word = words.find((candidate) => after.trimStart().startsWith(candidate.toLowerCase())) ?? "";
    const end = amount.end + (after.length - after.trimStart().length) + word.length;
    return [{ ...amount, end, direction }];
  });

const datesOf = (tree: StructureNode): DatedValue[] =>
  inDocumentOrder(tree).flatMap((node) => (node.kind === "date" ? [{ ...node.span, value: String(node.attrs["value"]) }] : []));

/** 相対で書いた日付（3日後の10月5日）が、基準の日付から数えた日と合わない。 */
export const relativeDateMismatch: Detector = (doc): Finding[] => {
  const tree = doc.structure;
  if (tree === undefined) return [];
  const dates = datesOf(tree);
  const fromTree = treeAmounts(doc, tree);
  const amounts = [...fromTree, ...wordAmounts(doc, [...fromTree, ...dates])];
  const input = {
    source: doc.source,
    sentences: doc.sentences.map((sentence) => sentence.span),
    dates,
    relatives: relativesOf(doc, amounts),
    links: patternsOf(doc, "relative-link"),
  };
  const counted = relativeMismatches(input).map((mismatch): Finding => ({
    rule: "relative-date-mismatch",
    severity: "warning",
    line: 0,
    column: 0,
    quote: quoteAt(doc.source, mismatch.target.start),
    values: {
      base: doc.source.slice(mismatch.base.start, mismatch.base.end),
      relative: doc.source.slice(mismatch.relative.start, mismatch.relative.end),
      target: doc.source.slice(mismatch.target.start, mismatch.target.end),
      expected: mismatch.expected,
      offset: mismatch.target.start,
    },
  }));
  return [...counted, ...dayWordFindings(doc, dates)];
};
