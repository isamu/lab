import type { Detector, Finding, ProseDocument, Sentence, Span } from "../plugin.ts";
import { calendarRuns, type CalendarRun, type CalendarUnits } from "../calendar-number.ts";
import { latinBoundaries, minorityStyle, occurrencesOutside, type Boundary, type SpacingKind } from "../orthography.ts";
import { isWithinAny, quotedSpans } from "../quoted-span.ts";
import { digitRunAround, isNumberName, sequenceLabelStarts } from "../number-name.ts";

/** チームが chaff.yaml の prefer に書いた「使わない書き方」。書いていなければ何も言わない。 */
export const preferredTerm: Detector = (doc, options): Finding[] => {
  const pairs = (options.lexicon ?? []).flatMap((entry) => (entry.instead_of === undefined ? [] : [{ avoid: entry.pattern, use: entry.instead_of }]));
  const hits = doc.sentences.flatMap((sentence) =>
    pairs.flatMap((pair) => occurrencesOutside(sentence.text, pair.avoid, pair.use).map((at) => ({ sentence, at, pair }))),
  );
  if (hits.length === 0 || hits.length < options.limit) return [];
  return hits.map((hit) => ({
    rule: "",
    severity: "warning",
    line: 0,
    column: 0,
    quote: hit.sentence.text.trim(),
    values: { matched: hit.pair.avoid, preferred: hit.pair.use, count: hits.length, limit: options.limit, offset: hit.sentence.span.start + hit.at },
  }));
};

const KIND_NAME: Readonly<Record<SpacingKind, string>> = { letter: "英字", "before-digit": "後ろの数字", "after-digit": "前の数字" };
const KINDS: readonly SpacingKind[] = ["letter", "before-digit", "after-digit"];

type Located = { readonly sentence: Sentence; readonly offset: number; readonly kind: SpacingKind; readonly spaced: boolean };

/** 境目の隣の数字の、並びの中の 1 字の位置。数字の後ろなら左の字、数字の前なら（空白を越えた）右の字。 */
const digitBeside = (boundary: Boundary): number => {
  if (boundary.kind === "after-digit") return boundary.offset - 1;
  return boundary.spaced ? boundary.offset + 1 : boundary.offset;
};

/** 文書全体で一度だけ読むもの。sequence は続き番号の行の頭、topUnits は都道府県の単位、calendar は日付・時刻の単位。 */
type NumberContext = { readonly sequence: ReadonlySet<number>; readonly topUnits: ReadonlySet<string>; readonly calendar: CalendarUnits };

/** 文の中の日付・時刻の数の、並びの頭の位置と、日付の中の位置。 */
const calendarPlaces = (sentence: Sentence, units: CalendarUnits): ReadonlyMap<number, CalendarRun["place"]> =>
  new Map(calendarRuns(sentence.text, sentence.tokens, sentence.span.start, units).map(({ run, place }) => [run.start, place]));

/**
 * 日付・時刻の中の境目（「9月」の数と単位のあいだ、「2026年9月」の年と 9 のあいだ）は、詰めて書く決まりで好みではない。
 * 日付の前の境目（「は 9月」の空白）は、数の前をどう空けるかという書き手の書き方なので数える。
 */
const isInsideCalendar = (boundary: Boundary, place: CalendarRun["place"] | undefined): boolean =>
  place !== undefined && (boundary.kind === "after-digit" || place === "inner");

/** 番号・識別子として書かれた数（number-name.ts）と日付・時刻の中の境目は、空け方の好みではないので数えない。 */
const isCounted = (sentence: Sentence, boundary: Boundary, context: NumberContext, calendar: ReadonlyMap<number, CalendarRun["place"]>): boolean => {
  if (boundary.kind === "letter") return true;
  const run = digitRunAround(sentence.text, digitBeside(boundary));
  if (run === undefined) return true;
  if (isInsideCalendar(boundary, calendar.get(run.start))) return false;
  return !isNumberName(sentence.text, run, sentence.tokens, sentence.span.start, context.sequence, context.topUnits);
};

const patternList = (doc: ProseDocument, id: string): string[] => (doc.lexicons[id] ?? []).map((entry) => entry.pattern);
const patternsOf = (doc: ProseDocument, id: string): ReadonlySet<string> => new Set(patternList(doc, id));

/**
 * 鉤括弧で引いた題名や発言（「…ガイドライン ver. 1.1」）の中の境目。空け方は引いた元のもので、書き手の書き方ではない。
 * 括弧は日本語の字でも英数字でもないので、境目はまるごと括弧の中か外にある。
 */
const isQuoted = (quoted: readonly Span[], boundary: Boundary): boolean => isWithinAny(quoted, { start: boundary.offset, end: boundary.offset });

/**
 * 日本語と英字・数字のあいだを、空けるか詰めるか。文書の中で混ざっていたら、少ないほうを指摘する。
 * どちらが正しいかは決めない。決めるのはチームで、chaff はそろっているかだけを見る。
 */
export const latinSpacing: Detector = (doc, options): Finding[] => {
  // 覆った文（prose）で探す。コードの中の「1 件」は並びに入れない。
  const context: NumberContext = {
    sequence: sequenceLabelStarts(doc.prose ?? doc.source),
    topUnits: patternsOf(doc, "prefecture-unit"),
    calendar: { chained: patternList(doc, "date-time-unit"), positional: patternsOf(doc, "calendar-unit"), year: patternsOf(doc, "calendar-year-unit") },
  };
  const located: Located[] = doc.sentences.flatMap((sentence) => {
    const quoted = quotedSpans(sentence.text);
    const calendar = calendarPlaces(sentence, context.calendar);
    return latinBoundaries(sentence.text, doc.source.slice(sentence.span.start, sentence.span.end))
      .filter((boundary) => !isQuoted(quoted, boundary) && isCounted(sentence, boundary, context, calendar))
      .map((boundary) => ({ sentence, ...boundary }));
  });
  return KINDS.flatMap((kind) => {
    const ofKind = located.filter((entry) => entry.kind === kind);
    const minority = minorityStyle(ofKind);
    if (minority === undefined) return [];
    const odd = ofKind.filter((entry) => entry.spaced === minority);
    if (odd.length < options.limit) return [];
    return odd.map((entry) => ({
      rule: "",
      severity: "warning",
      line: 0,
      column: 0,
      quote: entry.sentence.text.trim(),
      values: {
        kind: KIND_NAME[kind],
        style: minority ? "空けています" : "詰めています",
        usual: minority ? "詰める" : "空ける",
        count: odd.length,
        of: ofKind.length,
        limit: options.limit,
        offset: entry.sentence.span.start + entry.offset,
      },
    }));
  });
};
