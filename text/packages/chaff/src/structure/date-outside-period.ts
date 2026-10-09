import { escapeRegExp } from "../orthography.ts";
import type { StructureIssue } from "./issues.ts";
import { TABLE_ROW } from "./runs.ts";
import { afterLabel, statedPeriod, type DateMention, type Period, type PeriodWords } from "./stated-period.ts";

/**
 * 書いた期間の外の日付。期間の語で始まる一行（旅行期間：…）が期間を書き、その後ろ、同じ節の中の箇条書きの項目、表の行、見出しの日付を比べる。
 * 地の文の日付は、年の無いもの（2月12日（金）の午前は…）だけを比べる。年のある日付は、過去の回や別の年の出来事を挙げることが多い。
 * 期間の前後に置く予定（前泊、follow-up）、締め切りや予約の日、過去の回を言う語（period-aside）が、その行、文、節の見出しにあれば比べない。
 * 年の無い期間（12月28日〜1月4日）は年をまたいで読む。
 * 文書の仕事の期間（開講期間：…）を文書の頭か概要の節で書いたものは文書全体の期間で、後ろのどの節でも、締め切りの語（period-deadline）のある項目や文の、
 * 期間の終わりより後の年のある日付を指す（課題の提出が学期の後）。期間の前の締め切り（申込締切）と、旅行期間のように後に締め切りが来てよい期間は比べない。
 */
export type HeadingSpan = { readonly start: number; readonly end: number; readonly depth: number };
type Span = { readonly start: number; readonly end: number };

export type OutsideWords = PeriodWords & {
  readonly asides: readonly string[];
  /** 文書の仕事がその中で済む期間の語（開講期間、Term）。labels にも入れる。 */
  readonly terms: readonly string[];
  readonly deadlines: readonly string[];
  readonly overviews: readonly string[];
};

const LIST_ITEM = /^[ \t]{0,12}(?:[-*+]|\d{1,3}[.)])[ \t]/u;
const DAY_VALUE = /^(?:\d{4}-)?\d{2}-\d{2}$/u;

const hasYear = (value: string): boolean => value.length === "2026-01-01".length;
const monthDay = (value: string): string => value.slice(-"01-01".length);

/** 期間の中か。両方に年があれば年月日で、どちらかに年が無ければ月日で比べ、終わりが始まりより前の月日は年をまたぐ期間と読む。 */
export const insidePeriod = (value: string, period: Pick<Period, "start" | "end">): boolean => {
  if (hasYear(value) && hasYear(period.start)) return value >= period.start && value <= period.end;
  const [from, to, day] = [monthDay(period.start), monthDay(period.end), monthDay(value)];
  return from <= to ? day >= from && day <= to : day >= from || day <= to;
};

const linesOf = (source: string): Span[] =>
  source.split("\n").reduce<Span[]>((lines, text) => {
    const start = (lines.at(-1)?.end ?? -1) + 1;
    return [...lines, { start, end: start + text.length }];
  }, []);

const containing = <Item extends Span>(spans: readonly Item[], offset: number): Item | undefined =>
  spans.find((span) => span.start <= offset && offset <= span.end);

/** 英字の語は語の切れ目で、ほかは含むかで照らす。 */
export const mentions = (text: string, words: readonly string[]): boolean => {
  const lower = text.toLowerCase();
  return words.some((word) => {
    const target = word.toLowerCase();
    if (!/[a-z]/u.test(target)) return lower.includes(target);
    return new RegExp(`(?<![a-z])${escapeRegExp(target)}(?![a-z])`, "u").test(lower);
  });
};

type Stated = Period & { readonly line: Span; readonly scopeStart: number; readonly scopeEnd: number; readonly nextPeriod: number };

/**
 * 期間の及ぶ範囲の始まり: 期間の行の後ろ。期間の行が箇条書きの項目なら、その箇条書きの後ろ。
 * 「- Conference: May 3–5」「- Workshop: May 7」は催しを並べた一覧で、並んだ項目は期間の中の予定ではない。
 */
const scopeStart = (source: string, lines: readonly Span[], line: Span): number => {
  const isListLine = (span: Span): boolean => LIST_ITEM.test(source.slice(span.start, span.end));
  if (!isListLine(line)) return line.end;
  const after = lines.filter((span) => span.start > line.start);
  const listEnd = after.findIndex((span) => !isListLine(span));
  return (listEnd === -1 ? (after.at(-1) ?? line) : (after[listEnd - 1] ?? line)).end;
};

/** 期間の行が属する節の深さ。行が見出しならその深さ、そうでなければ前の見出しの深さ（見出しの前なら 0）。 */
const depthAt = (line: Span, headings: readonly HeadingSpan[]): number =>
  (containing(headings, line.start) ?? headings.filter((heading) => heading.start < line.start).at(-1))?.depth ?? 0;

/** 期間の及ぶ範囲の終わり: 同じか浅い深さの次の見出しか、次の期間の行。 */
const scopeEnd = (line: Span, next: number, headings: readonly HeadingSpan[], length: number): number => {
  const depth = depthAt(line, headings);
  const closing = headings.find((heading) => heading.start > line.end && heading.depth <= depth)?.start ?? length;
  return Math.min(closing, next);
};

const statedPeriods = (
  source: string,
  lines: readonly Span[],
  dates: readonly DateMention[],
  headings: readonly HeadingSpan[],
  words: OutsideWords,
): Stated[] => {
  const found = lines.flatMap((line) => {
    const period = statedPeriod(source.slice(line.start, line.end), line.start, dates, words);
    return period === undefined ? [] : [{ period, line }];
  });
  return found.map(({ period, line }, index) => ({
    ...period,
    line,
    nextPeriod: found[index + 1]?.line.start ?? source.length,
    scopeStart: scopeStart(source, lines, line),
    scopeEnd: scopeEnd(line, found[index + 1]?.line.start ?? source.length, headings, source.length),
  }));
};

const isItem = (text: string, line: Span, headings: readonly HeadingSpan[]): boolean =>
  LIST_ITEM.test(text) || TABLE_ROW.test(text) || containing(headings, line.start) !== undefined;

type Context = { readonly source: string; readonly lines: readonly Span[]; readonly headings: readonly HeadingSpan[]; readonly sentences: readonly Span[] };

/** 日付を囲む行（項目）か文（地の文）と、その節の見出し。期間の外に置く語を探す所。 */
const surroundings = (date: DateMention, line: Span, item: boolean, context: Context): string[] => {
  const unit = item ? line : (containing(context.sentences, date.offset) ?? line);
  const heading = context.headings.filter((candidate) => candidate.start <= date.offset).at(-1);
  return [context.source.slice(unit.start, unit.end), heading === undefined ? "" : context.source.slice(heading.start, heading.end)];
};

const outsideOne = (date: DateMention, period: Stated, context: Context, asides: readonly string[]): boolean => {
  if (!DAY_VALUE.test(date.value) || insidePeriod(date.value, period)) return false;
  const line = containing(context.lines, date.offset);
  if (line === undefined) return false;
  const item = isItem(context.source.slice(line.start, line.end), line, context.headings);
  if (!item && hasYear(date.value)) return false;
  return !surroundings(date, line, item, context).some((text) => mentions(text, asides));
};

const boundaryPattern = (word: string): RegExp => {
  const target = escapeRegExp(word.toLowerCase());
  return /[a-z]/u.test(word.toLowerCase()) ? new RegExp(`(?<![a-z])${target}(?![a-z])`, "gu") : new RegExp(target, "gu");
};

/** 締め切りの語を除いた文。「提出期限」の「期限」、「submit by」の「submit」は、期間の外に置く語として読まない。 */
const withoutWords = (text: string, words: readonly string[]): string =>
  words.toSorted((left, right) => right.length - left.length).reduce((rest, word) => rest.replace(boundaryPattern(word), " "), text.toLowerCase());

/** 節の見出しの並び（その行の見出しと、それを囲む浅い見出し）。 */
const enclosingHeadings = (offset: number, headings: readonly HeadingSpan[]): HeadingSpan[] =>
  headings
    .filter((heading) => heading.start < offset)
    .toReversed()
    .reduce<HeadingSpan[]>((chain, heading) => (heading.depth < (chain.at(-1)?.depth ?? Infinity) ? [...chain, heading] : chain), []);

/** 文書の仕事の期間か: その語（period-term-label）で始まり、表題（文書の頭の # の見出し）のほかの見出しより前か、概要の節（period-overview-heading）の行。 */
const isDocumentTerm = (period: Stated, context: Context, words: OutsideWords): boolean => {
  if (afterLabel(context.source.slice(period.line.start, period.line.end), words.terms) === undefined) return false;
  const sections = context.headings.filter((heading, index) => heading.start < period.line.start && !(index === 0 && heading.depth === 1));
  if (sections.length === 0) return true;
  return enclosingHeadings(period.line.start, context.headings).some((heading) => mentions(context.source.slice(heading.start, heading.end), words.overviews));
};

const afterEnd = (value: string, period: Period): boolean => hasYear(value) && hasYear(period.end) && value > period.end;

const lateDeadline = (date: DateMention, period: Stated, context: Context, words: OutsideWords): boolean => {
  if (!DAY_VALUE.test(date.value) || !afterEnd(date.value, period)) return false;
  const line = containing(context.lines, date.offset);
  if (line === undefined) return false;
  const texts = surroundings(date, line, isItem(context.source.slice(line.start, line.end), line, context.headings), context);
  if (!mentions(texts[0] ?? "", words.deadlines)) return false;
  return !texts.some((text) => mentions(withoutWords(text, words.deadlines), words.asides));
};

const issueOf = (source: string, date: DateMention, period: Stated): StructureIssue => ({
  offset: date.offset,
  values: { date: source.slice(date.offset, date.end), period: period.written },
});

const inScope = (date: DateMention, period: Stated): boolean => date.offset > period.scopeStart && date.offset < period.scopeEnd;
const inDocument = (date: DateMention, period: Stated): boolean => date.offset > period.line.end && date.offset < period.nextPeriod;

export const datesOutsidePeriod = (
  source: string,
  dates: readonly DateMention[],
  headings: readonly HeadingSpan[],
  sentences: readonly Span[],
  words: OutsideWords,
): StructureIssue[] => {
  const lines = linesOf(source);
  const context: Context = { source, lines, headings, sentences };
  return statedPeriods(source, lines, dates, headings, words).flatMap((period) => {
    const documentWide = isDocumentTerm(period, context, words);
    return dates
      .filter(
        (date) =>
          (inScope(date, period) && outsideOne(date, period, context, words.asides)) ||
          (documentWide && inDocument(date, period) && lateDeadline(date, period, context, words)),
      )
      .map((date) => issueOf(source, date, period));
  });
};
