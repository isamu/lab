import type { Detector, Finding, ProseDocument, Span, StructureNode } from "../plugin.ts";
import { inDocumentOrder } from "../structure/issues.ts";
import { documentDateOf } from "./document-date.ts";
import { overlapsAny, spanIndex } from "../compare/spans.ts";
import { yearOf, type DurationUnit } from "../derived/date-arithmetic.ts";
import { durationMismatches, type DatedValue, type Duration } from "../derived/durations.ts";
import { elapsedMismatches, type Elapsed, type OriginWord, type Year } from "../derived/elapsed.ts";
import { numberWordCounts } from "../derived/number-word-counts.ts";
import { quoteAt } from "./structure-tree.ts";

/** 期間の単位の語彙表。木の数量の単位がどれかに入れば、その単位の期間。 */
const DURATION_LEXICONS: readonly (readonly [string, DurationUnit])[] = [
  ["duration-day", "day"],
  ["duration-week", "week"],
  ["duration-month", "month"],
  ["duration-year", "year"],
];

type Quantity = Span & { readonly amount: number; readonly unit: string };

const patternsOf = (doc: ProseDocument, id: string): string[] => (doc.lexicons[id] ?? []).map((entry) => entry.pattern);

const positioned = (doc: ProseDocument, id: string, position: "before" | "after"): string[] =>
  (doc.lexicons[id] ?? []).filter((entry) => (entry.position ?? "before") === position).map((entry) => entry.pattern.toLowerCase());

/** 数のすぐ後ろ（空白一つまで）に書いた単位まで。木の数量は単位の前で終わることがある（30 years の 30）。 */
const endWithUnit = (source: string, end: number, unit: string): number => {
  const gap = source.charAt(end) === " " ? 1 : 0;
  return unit !== "" && source.startsWith(unit, end + gap) ? end + gap + unit.length : end;
};

/** The number in words before a figure in brackets: "six (" in "six (6) months". */
const WORDS_BEFORE_BRACKET = /[\p{L}-]+ \($/u;
const BRACKET_REACH = 20;

/** 「six (6) months」は語の数から単位まで。括弧の中の数だけでは、指摘に引いたとき何の期間か読めない。 */
const withWordsAround = (source: string, start: number, end: number, unit: string): Span => {
  const before = WORDS_BEFORE_BRACKET.exec(source.slice(Math.max(0, start - BRACKET_REACH), start));
  return source.charAt(end) === ")" && before !== null ? { start: start - before[0].length, end: endWithUnit(source, end + 1, unit) } : { start, end: endWithUnit(source, end, unit) };
};

const quantitiesOf = (tree: StructureNode, source: string): Quantity[] =>
  inDocumentOrder(tree).flatMap((node): Quantity[] => {
    if (node.kind !== "quantity") return [];
    const unit = String(node.attrs["unit"] ?? "");
    return [{ ...withWordsAround(source, node.span.start, node.span.end, unit), amount: Number(node.attrs["value"]), unit: unit.normalize("NFKC") }];
  });

const datesOf = (tree: StructureNode): DatedValue[] =>
  inDocumentOrder(tree).flatMap((node) => (node.kind === "date" ? [{ ...node.span, value: String(node.attrs["value"]) }] : []));

const NEAR = 12;

const textBefore = (doc: ProseDocument, span: Span): string =>
  doc.source
    .slice(Math.max(0, span.start - NEAR), span.start)
    .toLowerCase()
    .trimEnd();
const textAfter = (doc: ProseDocument, span: Span): string =>
  doc.source
    .slice(span.end, span.end + NEAR)
    .toLowerCase()
    .trimStart();

/** 「約3か月」「3か月程度」"about 3 months": 目安の期間は足し算に使わない。 */
const isApproximate = (doc: ProseDocument, span: Span): boolean =>
  positioned(doc, "approximate-marker", "before").some((word) => textBefore(doc, span).endsWith(word)) ||
  positioned(doc, "approximate-marker", "after").some((word) => textAfter(doc, span).startsWith(word));

const durationsOf = (doc: ProseDocument, quantities: readonly Quantity[]): Duration[] =>
  quantities.flatMap((quantity) => {
    const unit = DURATION_LEXICONS.find(([id]) => patternsOf(doc, id).some((pattern) => pattern.normalize("NFKC") === quantity.unit))?.[1];
    return unit === undefined || isApproximate(doc, quantity) ? [] : [{ start: quantity.start, end: quantity.end, amount: quantity.amount, unit }];
  });

const sentencesOf = (doc: ProseDocument): Span[] => doc.sentences.map((sentence) => sentence.span);

/** 始まり + 期間 ≠ 終わり。 */
export const durationMismatch: Detector = (doc): Finding[] => {
  if (doc.structure === undefined) return [];
  const durations = durationsOf(doc, quantitiesOf(doc.structure, doc.source));
  return durationMismatches(sentencesOf(doc), datesOf(doc.structure), durations).map((mismatch) => ({
    rule: "duration-mismatch",
    severity: "warning",
    line: 0,
    column: 0,
    quote: quoteAt(doc.source, mismatch.end.start),
    values: {
      start: doc.source.slice(mismatch.start.start, mismatch.start.end),
      duration: doc.source.slice(mismatch.duration.start, mismatch.duration.end),
      end: doc.source.slice(mismatch.end.start, mismatch.end.end),
      expected: mismatch.expected,
      offset: mismatch.end.start,
    },
  }));
};

/** 四桁の年。木が日付と読まなかった英語の年（founded in 2015、born 1980）もここで読む。 */
const BARE_YEAR = /(?<![\p{N}.,])[12]\d{3}(?!\p{N})/gu;

const yearsOf = (doc: ProseDocument, tree: StructureNode, quantities: readonly Quantity[]): Year[] => {
  const dated = datesOf(tree).flatMap((date): Year[] => {
    const year = yearOf(date.value);
    return year === undefined ? [] : [{ start: date.start, end: date.end, year }];
  });
  const taken = spanIndex([...datesOf(tree), ...quantities]);
  const bare = [...doc.source.matchAll(BARE_YEAR)].flatMap((match): Year[] => {
    const span = { start: match.index, end: match.index + match[0].length };
    return overlapsAny(taken, span) ? [] : [{ ...span, year: Number(match[0]) }];
  });
  return [...dated, ...bare];
};

const LATIN = /^[a-z ]+$/iu;
const WORD_CHAR = /[\p{L}\p{N}]/u;

/** 語彙表の語が書かれた所。英字の語は語の切れ目でだけ。 */
const wordsOf = (doc: ProseDocument, id: string): OriginWord[] =>
  patternsOf(doc, id).flatMap((pattern) => {
    const lower = doc.source.toLowerCase();
    const needle = pattern.toLowerCase();
    const found: OriginWord[] = [];
    for (let at = lower.indexOf(needle); at !== -1; at = lower.indexOf(needle, at + needle.length)) {
      const bounded = !LATIN.test(pattern) || (!WORD_CHAR.test(lower.charAt(at - 1)) && !WORD_CHAR.test(lower.charAt(at + needle.length)));
      if (bounded) found.push({ start: at, end: at + needle.length, pattern });
    }
    return found;
  });

/** 年齢: 単位が年齢の語（歳）か、年齢の印（aged、years old）の付いた数量。 */
const isAge = (doc: ProseDocument, quantity: Quantity): boolean =>
  patternsOf(doc, "age-unit").some((unit) => unit.normalize("NFKC") === quantity.unit) ||
  positioned(doc, "age-marker", "before").some((word) => textBefore(doc, quantity).endsWith(word)) ||
  positioned(doc, "age-marker", "after").some((word) => textAfter(doc, quantity).startsWith(word));

/** 年数: 単位が年数の語の数量（10 years、創業10年）と、木が読まない語で書いた数（ten years）。 */
const elapsedOf = (doc: ProseDocument, quantities: readonly Quantity[]): Elapsed[] => {
  const units = patternsOf(doc, "elapsed-unit");
  const counted = quantities.filter((quantity) => !isAge(doc, quantity) && units.some((unit) => unit.normalize("NFKC") === quantity.unit));
  const taken = spanIndex(quantities);
  const worded = numberWordCounts(doc.source, patternsOf(doc, "count-number"), units).filter((count) => !overlapsAny(taken, count));
  return [...counted, ...worded].toSorted((left, right) => left.start - right.start);
};

/** 「aged 45」の 45: 英語の木は単位の無い数を読まないので、年齢の印のすぐ後ろの数を読む。 */
const AGE_NUMBER = /^\s*(\d{1,3})(?!\d)/u;

const markedAges = (doc: ProseDocument): Elapsed[] =>
  positioned(doc, "age-marker", "before").flatMap((marker) =>
    wordsOf(doc, "age-marker")
      .filter((word) => word.pattern.toLowerCase() === marker)
      .flatMap((word): Elapsed[] => {
        const number = AGE_NUMBER.exec(doc.source.slice(word.end));
        if (number === null) return [];
        const start = word.end + number[0].length - (number[1] ?? "").length;
        return [{ start, end: word.end + number[0].length, amount: Number(number[1]) }];
      }),
  );

/** 文書の日付の年: 日付だけの段落か「更新日：」の段落（date-stamp）の、最初の日付。 */
const referenceYear = (doc: ProseDocument, tree: StructureNode): number | undefined => {
  const date = documentDateOf(doc, tree);
  return date === undefined ? undefined : yearOf(date);
};

/** 起点の年から数えた年数が、文書の日付と合わない。 */
export const elapsedYearsMismatch: Detector = (doc): Finding[] => {
  const tree = doc.structure;
  const reference = tree === undefined ? undefined : referenceYear(doc, tree);
  if (tree === undefined || reference === undefined) return [];
  const quantities = quantitiesOf(tree, doc.source);
  const quantityAges = quantities.filter((quantity) => isAge(doc, quantity));
  const taken = spanIndex(quantityAges);
  const ages = [...quantityAges, ...markedAges(doc).filter((age) => !overlapsAny(taken, age))].toSorted((left, right) => left.start - right.start);
  const input = {
    source: doc.source,
    sentences: sentencesOf(doc),
    years: yearsOf(doc, tree, quantities),
    foundings: wordsOf(doc, "elapsed-origin"),
    births: wordsOf(doc, "birth-origin"),
    elapsed: elapsedOf(doc, quantities),
    ages,
    links: patternsOf(doc, "elapsed-link"),
    reference,
  };
  return elapsedMismatches(input).map((mismatch) => ({
    rule: "elapsed-years-mismatch",
    severity: "warning",
    line: 0,
    column: 0,
    quote: quoteAt(doc.source, mismatch.elapsed.start),
    values: {
      written: doc.source.slice(mismatch.elapsed.start, mismatch.elapsed.end),
      origin: doc.source.slice(mismatch.origin.start, mismatch.origin.end),
      reference,
      expected: mismatch.expected,
      offset: mismatch.elapsed.start,
    },
  }));
};
