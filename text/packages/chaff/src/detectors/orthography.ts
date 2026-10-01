import type { Detector, Finding, ProseDocument, Sentence, Span } from "../plugin.ts";
import { calendarRuns, calendarUnitsOf, type CalendarUnits } from "../calendar-number.ts";
import { latinBoundaries, occurrencesOutside, type Boundary, type SpacingKind } from "../orthography.ts";
import { minorityReport } from "../spacing-minority.ts";
import { isWithinAny, quotedSpans } from "../quoted-span.ts";
import { digitRunAround, endsWithDivisionLabel, isNumberName, sequenceLabelStarts, type NameContext } from "../number-name.ts";

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

/**
 * 文書全体で一度だけ読むもの（number-name.ts の NameContext に加えて）。calendar は日付・時刻の単位、
 * divisions は「第1節」のように「第」と番号の後ろに書く区切りの語。
 */
type NumberContext = NameContext & {
  readonly calendar: CalendarUnits;
  readonly divisions: ReadonlySet<string>;
  readonly itemNumber: RegExp | undefined;
};

/** 文頭の項目の番号の後ろと見る境目の位置の上限。番号は短く文の頭にあるので、これより後ろの境目は番号の後ろではない。長い文で文頭からの切り出しを繰り返さない。 */
const ITEM_NUMBER_REACH = 8;

/** 番号の付いた項目の並びと読む、行の頭の違う番号の数。一行だけの「十 GBまで…」は数量。 */
const MIN_ITEM_NUMBERS = 2;

/**
 * 行の頭の項目の番号だけ（語彙表 item-number）。「一 JIS X 0201…」の空白は項目の区切り。
 * 文書が行の頭に違う番号を二つ以上、空白で区切って並べているときだけ。
 */
const itemNumberHead = (patterns: readonly string[], source: string): RegExp | undefined => {
  if (patterns.length === 0) return undefined;
  const alternatives = patterns.join("|");
  const heads = new Set([...source.matchAll(new RegExp(`^[ \\t\\-*+]*(${alternatives})[ \\u3000]`, "gmu"))].map((match) => match[1]));
  return heads.size < MIN_ITEM_NUMBERS ? undefined : new RegExp(`^[\\s\\-*+]*(?:${alternatives})$`, "u");
};

/** 文の中の日付・時刻の数の、並びの頭の位置。 */
const calendarStarts = (sentence: Sentence, units: CalendarUnits): ReadonlySet<number> =>
  new Set(calendarRuns(sentence.text, sentence.tokens, sentence.span.start, units).map(({ run }) => run.start));

/**
 * 番号・識別子として書かれた数（number-name.ts）、日付・時刻の数、「第1節」の後ろの境目、文頭の項目の番号（「一 JIS」）の後ろの境目は、空け方の好みではないので数えない。
 * 日付・時刻は前の境目（「は 9月」「午後3時」「令和 3 年」）も数えない。日付はまとめて一つの書き方で、数量の空け方の票にはしない。
 */
const isCounted = (sentence: Sentence, boundary: Boundary, context: NumberContext, calendar: ReadonlySet<number>): boolean => {
  if (boundary.offset <= ITEM_NUMBER_REACH && context.itemNumber?.test(sentence.text.slice(0, boundary.offset)) === true) return false;
  if (boundary.kind !== "after-digit" && endsWithDivisionLabel(sentence.text.slice(0, boundary.offset), context.divisions)) return false;
  if (boundary.kind === "letter") return true;
  const run = digitRunAround(sentence.text, digitBeside(boundary));
  if (run === undefined) return true;
  if (calendar.has(run.start)) return false;
  return !isNumberName(sentence.text, run, sentence.tokens, sentence.span.start, context);
};

const patternList = (doc: ProseDocument, id: string): string[] => (doc.lexicons[id] ?? []).map((entry) => entry.pattern);
const patternsOf = (doc: ProseDocument, id: string): ReadonlySet<string> => new Set(patternList(doc, id));

/** 語彙表 numbered-label のうち、番号の position 側に書く語。 */
const labelsAt = (doc: ProseDocument, position: "before" | "after"): ReadonlySet<string> =>
  new Set((doc.lexicons["numbered-label"] ?? []).filter((entry) => entry.position === position).map((entry) => entry.pattern));

/**
 * 鉤括弧で引いた題名や発言（「…ガイドライン ver. 1.1」）の中の境目。空け方は引いた元のもので、書き手の書き方ではない。
 * 括弧は日本語の字でも英数字でもないので、境目はまるごと括弧の中か外にある。
 */
const isQuoted = (quoted: readonly Span[], boundary: Boundary): boolean => isWithinAny(quoted, { start: boundary.offset, end: boundary.offset });

/**
 * リンクの文字の中の境目。リンクの文字は引いた記事や資料の題であることが多く、空け方は元のものなので、鉤括弧の中と同じに数えない。
 * リンクの外側の端（「を [記事]」の空白）は書き手の空け方なので数える。at は文書全体の位置。
 */
const isInsideLink = (links: readonly Span[], at: number): boolean => links.some((link) => link.start < at && at < link.end);

const findingAt = (entry: Located, values: Finding["values"], variant?: string): Finding => ({
  rule: "",
  severity: "warning",
  line: 0,
  column: 0,
  quote: entry.sentence.text.trim(),
  ...(variant === undefined ? {} : { variant }),
  values: { ...values, offset: entry.sentence.span.start + entry.offset },
});

/** 一つの種類の境目の指摘。少ないほうを 1 箇所ずつか、書き方が二通りあれば 1 件で（spacing-minority.ts）。 */
const findingsOf = (kind: SpacingKind, ofKind: readonly Located[], limit: number): Finding[] => {
  const report = minorityReport(ofKind, limit);
  if (report === undefined) return [];
  if (report.mode === "mixed") {
    const { first, odd, spaced, touching } = report;
    return [findingAt(first, { kind: KIND_NAME[kind], spaced, touching, count: odd, of: ofKind.length, limit }, "mixed")];
  }
  const minority = report.odd[0]?.spaced ?? false;
  return report.odd.map((entry) =>
    findingAt(entry, {
      kind: KIND_NAME[kind],
      style: minority ? "空けています" : "詰めています",
      usual: minority ? "詰める" : "空ける",
      count: report.odd.length,
      of: ofKind.length,
      limit,
    }),
  );
};

/**
 * 日本語と英字・数字のあいだを、空けるか詰めるか。文書の中で混ざっていたら、少ないほうを指摘する。
 * どちらが正しいかは決めない。決めるのはチームで、chaff はそろっているかだけを見る。
 */
export const latinSpacing: Detector = (doc, options): Finding[] => {
  // 覆った文（prose）で探す。コードの中の「1 件」は並びに入れない。
  const context: NumberContext = {
    sequence: sequenceLabelStarts(doc.prose ?? doc.source),
    topUnits: patternsOf(doc, "prefecture-unit"),
    labelWords: labelsAt(doc, "before"),
    calendar: calendarUnitsOf(doc),
    divisions: labelsAt(doc, "after"),
    itemNumber: itemNumberHead(patternList(doc, "item-number"), doc.prose ?? doc.source),
  };
  const located: Located[] = doc.sentences.flatMap((sentence) => {
    const quoted = quotedSpans(sentence.text);
    const calendar = calendarStarts(sentence, context.calendar);
    return latinBoundaries(sentence.text, doc.source.slice(sentence.span.start, sentence.span.end))
      .filter((boundary) => !isQuoted(quoted, boundary) && !isInsideLink(doc.links, sentence.span.start + boundary.offset))
      .filter((boundary) => isCounted(sentence, boundary, context, calendar))
      .map((boundary) => ({ sentence, ...boundary }));
  });
  return KINDS.flatMap((kind) =>
    findingsOf(
      kind,
      located.filter((entry) => entry.kind === kind),
      options.limit,
    ),
  );
};
