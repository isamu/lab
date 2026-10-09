import type { Detector, Finding, ProseDocument, Span, StructureNode } from "../plugin.ts";
import { inDocumentOrder } from "../structure/issues.ts";
import { documentDateOf } from "./document-date.ts";
import { overlapsAny, spanIndex } from "../compare/spans.ts";
import { yearOf, type DurationUnit } from "../derived/date-arithmetic.ts";
import { durationMismatches, type DatedValue, type Duration } from "../derived/durations.ts";
import { elapsedMismatches, type Elapsed, type OriginWord, type Year } from "../derived/elapsed.ts";
import { numberWordCounts } from "../derived/number-word-counts.ts";
import {
  nightsDaysMismatches,
  nightsDaysPairs,
  stayNightsMismatches,
  tableNightsMismatches,
  type Count,
  type NightsMismatch,
  type StayColumnWords,
} from "../derived/stays.ts";
import { numeralCounts } from "../derived/unit-counts.ts";
import { timeLengths, type LengthWords, type TimeLength } from "../derived/time-lengths.ts";
import { workingHoursMismatches, type WorkingHoursMismatch } from "../derived/working-hours.ts";
import { sessionHoursMismatches } from "../derived/session-hours.ts";
import { clockTimes } from "../compare/clock-time.ts";
import { secondsOf, type Mark } from "../structure/time-marks.ts";
import { proseAndTablesOf } from "../table-text.ts";
import { quoteAt } from "./structure-tree.ts";

/** 期間の単位の語彙表。木の数量の単位がどれかに入れば、その単位の期間。 */
export const DURATION_LEXICONS: readonly (readonly [string, DurationUnit])[] = [
  ["duration-day", "day"],
  ["duration-week", "week"],
  ["duration-month", "month"],
  ["duration-year", "year"],
];

export type Quantity = Span & { readonly amount: number; readonly unit: string };

const patternsOf = (doc: ProseDocument, id: string): string[] => (doc.lexicons[id] ?? []).map((entry) => entry.pattern);

const positioned = (doc: ProseDocument, id: string, position: "before" | "after"): string[] =>
  (doc.lexicons[id] ?? []).filter((entry) => (entry.position ?? "before") === position).map((entry) => entry.pattern.toLowerCase());

/** 数のすぐ後ろ（空白一つまで）に書いた単位まで。木の数量は単位の前で終わることがある（30 years の 30）。 */
const endWithUnit = (source: string, end: number, unit: string): number => {
  const gap = source.charAt(end) === " " ? 1 : 0;
  return unit !== "" && source.startsWith(unit, end + gap) ? end + gap + unit.length : end;
};

const OPEN_BRACKET = " (";
const WORD_LETTER = /[\p{L}-]/u;

/** Where the word before " (" starts ("six (" in "six (6) months"), or undefined when no word stands there. */
const wordStartBeforeBracket = (source: string, at: number): number | undefined => {
  if (source.slice(Math.max(0, at - OPEN_BRACKET.length), at) !== OPEN_BRACKET) return undefined;
  let start = at - OPEN_BRACKET.length;
  while (start > 0 && WORD_LETTER.test(source.charAt(start - 1))) start -= 1;
  return start < at - OPEN_BRACKET.length ? start : undefined;
};

/** 「six (6) months」は語の数から単位まで。括弧の中の数だけでは、指摘に引いたとき何の期間か読めない。 */
const withWordsAround = (source: string, start: number, end: number, unit: string): Span => {
  const wordStart = source.charAt(end) === ")" ? wordStartBeforeBracket(source, start) : undefined;
  return wordStart === undefined ? { start, end: endWithUnit(source, end, unit) } : { start: wordStart, end: endWithUnit(source, end + 1, unit) };
};

export const quantitiesOf = (tree: StructureNode, source: string): Quantity[] =>
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

/** 泊数（3泊、3 nights、three nights）。text は地の文と表（リンク先や code は読まない）。目安の泊数（最大3泊）は除く。 */
/** 数と単位（3泊、15 sessions、three nights）。 */
const unitCountsOf = (doc: ProseDocument, text: string, units: readonly string[]): Count[] => {
  const numerals = numeralCounts(text, units);
  const taken = spanIndex(numerals);
  const worded = numberWordCounts(text, patternsOf(doc, "count-number"), units).filter((count) => !overlapsAny(taken, count));
  return [...numerals, ...worded].toSorted((left, right) => left.start - right.start);
};

const nightsOf = (doc: ProseDocument, text: string): Count[] =>
  unitCountsOf(doc, text, patternsOf(doc, "stay-night")).filter((count) => !isApproximate(doc, count));

const finding = (doc: ProseDocument, offset: number, values: Record<string, string | number>, variant?: string): Finding => ({
  rule: "duration-mismatch",
  severity: "warning",
  line: 0,
  column: 0,
  quote: quoteAt(doc.source, offset),
  ...(variant === undefined ? {} : { variant }),
  values: { ...values, offset },
});

const written = (doc: ProseDocument, span: Span): string => doc.source.slice(span.start, span.end);

const nightsFinding = (doc: ProseDocument, mismatch: NightsMismatch): Finding =>
  finding(
    doc,
    mismatch.nights.start,
    { start: written(doc, mismatch.start), end: written(doc, mismatch.end), nights: written(doc, mismatch.nights).trim(), expected: mismatch.expected },
    "nights",
  );

const stayColumnWords = (doc: ProseDocument): StayColumnWords => ({
  checkIn: patternsOf(doc, "stay-check-in-column"),
  checkOut: patternsOf(doc, "stay-check-out-column"),
  nights: patternsOf(doc, "stay-nights-column"),
  units: patternsOf(doc, "stay-night"),
});

const marksOf = (doc: ProseDocument, id: string): Mark[] =>
  (doc.lexicons[id] ?? []).map((entry) => ({ pattern: entry.pattern, position: entry.position, group: entry.group }));

const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_MINUTE = 60;

/** The hour and minute units of unit-time, told apart by their weight in seconds. */
const unitsWeighing = (doc: ProseDocument, seconds: number): string[] =>
  (doc.lexicons["unit-time"] ?? []).filter((entry) => entry.weight === seconds).map((entry) => entry.pattern);

const lengthWords = (doc: ProseDocument): LengthWords => ({
  hourUnits: unitsWeighing(doc, SECONDS_PER_HOUR),
  minuteUnits: unitsWeighing(doc, SECONDS_PER_MINUTE),
  halves: patternsOf(doc, "length-half"),
  numberWords: patternsOf(doc, "count-number"),
});

const lengthsOf = (doc: ProseDocument, text: string): TimeLength[] => timeLengths(text, lengthWords(doc));

const MINUTES_PER_HOUR = 60;
const HOUR_DECIMALS = 100;

const hoursOf = (minutes: number): number => Math.round((minutes / MINUTES_PER_HOUR) * HOUR_DECIMALS) / HOUR_DECIMALS;

const workingHoursFinding = (doc: ProseDocument, mismatch: WorkingHoursMismatch): Finding =>
  finding(
    doc,
    mismatch.total.start,
    {
      start: written(doc, mismatch.start),
      end: written(doc, mismatch.end),
      break: written(doc, mismatch.break),
      total: written(doc, mismatch.total),
      expected: hoursOf(mismatch.expected),
    },
    "working-hours",
  );

/** 始業から終業まで、休憩を除いた時間が、書いた実働と合わない。 */
const workingHoursOf = (doc: ProseDocument, text: string): Finding[] => {
  const times = clockTimes(text).map((time) => ({ start: time.start, end: time.end, seconds: secondsOf(time.key) }));
  const words = {
    joiners: patternsOf(doc, "clock-range-joiner"),
    dayShifts: marksOf(doc, "day-shift-mark"),
    breaks: marksOf(doc, "working-hours-break"),
    totals: marksOf(doc, "working-hours-total"),
    approximate: marksOf(doc, "approximate-marker"),
  };
  return workingHoursMismatches(text, doc.source, sentencesOf(doc), times, lengthsOf(doc, text), words).map((mismatch) => workingHoursFinding(doc, mismatch));
};

/** 始まり + 期間 ≠ 終わり。泊数が二つの日付の差と合わない。「2泊3日」の日数が泊数より一つ多くない。 */
export const durationMismatch: Detector = (doc): Finding[] => {
  if (doc.structure === undefined) return [];
  const dates = datesOf(doc.structure);
  const durations = durationsOf(doc, quantitiesOf(doc.structure, doc.source));
  const proseAndTables = proseAndTablesOf(doc);
  const nights = nightsOf(doc, proseAndTables);
  const pairs = nightsDaysPairs(
    doc.source,
    nights,
    durations.filter((duration) => duration.unit === "day"),
    patternsOf(doc, "stay-pair-joiner"),
  );
  const pairedDays = spanIndex(pairs.map((pair) => pair.days));
  const lengths = durationMismatches(
    sentencesOf(doc),
    dates,
    durations.filter((duration) => !overlapsAny(pairedDays, duration)),
  ).map((mismatch) =>
    finding(doc, mismatch.end.start, {
      start: written(doc, mismatch.start),
      duration: written(doc, mismatch.duration),
      end: written(doc, mismatch.end),
      expected: mismatch.expected,
    }),
  );
  const stays = [...stayNightsMismatches(sentencesOf(doc), dates, nights), ...tableNightsMismatches(proseAndTables, dates, stayColumnWords(doc))];
  const nightsDays = nightsDaysMismatches(pairs).map((mismatch) =>
    finding(doc, mismatch.days.start, { nights: written(doc, mismatch.nights), days: written(doc, mismatch.days), expected: mismatch.expected }, "nights-days"),
  );
  return [...lengths, ...stays.map((mismatch) => nightsFinding(doc, mismatch)), ...nightsDays, ...workingHoursOf(doc, proseAndTables)];
};

/** 番号の書き方（ordinal-frame）の頭の語のすぐ後ろの数。「第15回」は15番目の回で、15回ではない。 */
const isOrdinal = (doc: ProseDocument, text: string, count: Span): boolean =>
  patternsOf(doc, "ordinal-frame").some((frame) => {
    const head = frame.split("{n}")[0] ?? "";
    return head !== "" && text.slice(Math.max(0, count.start - head.length), count.start).toLowerCase() === head.toLowerCase();
  });

/** 回数 × 1回の長さが、書いた合計と合わない（90分×15回（計24時間））。 */
export const durationProductMismatch: Detector = (doc): Finding[] => {
  const text = proseAndTablesOf(doc);
  const counts = unitCountsOf(doc, text, patternsOf(doc, "session-count-unit")).filter((count) => !isOrdinal(doc, text, count));
  const words = { totals: marksOf(doc, "session-total"), approximate: marksOf(doc, "approximate-marker") };
  return sessionHoursMismatches(text, doc.source, sentencesOf(doc), counts, lengthsOf(doc, text), words).map((mismatch) => ({
    rule: "duration-product-mismatch",
    severity: "warning",
    line: 0,
    column: 0,
    quote: quoteAt(doc.source, mismatch.total.start),
    values: {
      count: written(doc, mismatch.count),
      length: written(doc, mismatch.length),
      total: written(doc, mismatch.total),
      expected: hoursOf(mismatch.expected),
      offset: mismatch.total.start,
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
