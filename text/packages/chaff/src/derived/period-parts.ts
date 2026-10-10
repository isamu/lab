import type { Span } from "../plugin.ts";
import type { DurationUnit } from "./date-arithmetic.ts";
import { escapeRegExp } from "../orthography.ts";

/**
 * 期間の一部として書いた期間（「保証期間（12か月）のうち、無料交換期間は18か月」"Within the 12-month warranty period, the free
 * replacement period is 18 months"）が、全体より長い所。全体の長さは、印の前後に書いた長さ（括弧の中、名詞の前）を読み、無ければ
 * 同じ節で全体の名前（保証期間）に書いた長さを読む。「このうち」"within it" は前の文の長さ。目安の長さ、幅のある長さ、延長や追加の期間
 * （全体の後に来る期間）は比べない。年と月、週と日の間だけ換算する。
 */
export type PeriodLength = Span & { readonly amount: number; readonly unit: DurationUnit };

/** 全体と部分をつなぐ印。position は全体から見た印の側（のうち は全体の後ろ after、within the は前 before）。 */
export type PartMarker = { readonly pattern: string; readonly position: "before" | "after"; readonly group?: string | undefined };

export type PlacedWord = { readonly pattern: string; readonly position: "before" | "after" };

export type PeriodPartWords = {
  readonly markers: readonly PartMarker[];
  /** 期間の名前の終わりの語（期間、period）。 */
  readonly periodWords: readonly string[];
  /** 全体の後に来る期間の語（延長、extended）。文にあれば読まない。 */
  readonly afterWords: readonly string[];
  /** 名前の後ろで長さを言う語（the warranty runs for 12 months の runs for）。 */
  readonly lengthVerbs: readonly string[];
  readonly approximate: readonly PlacedWord[];
  readonly rangeJoiners: readonly string[];
  /** 長さと名前の間に置く語（12か月の保証期間 の の）。空白だけの間はいつでもよい。 */
  readonly inlineJoiners: readonly string[];
  /** 期間の語の前に来ても名前にならない語（the period、that period）。 */
  readonly unnamed: readonly string[];
};

export type PeriodPartIssue = { readonly part: PeriodLength; readonly whole: PeriodLength };

/** 印の group。anaphor は前の文の期間を全体にする（このうち）。adjacent は部分を印のすぐ前に書く（18 months of the warranty）。 */
const ANAPHOR = "anaphor";
const ADJACENT = "adjacent";

type Whole = { readonly phrase: Span; readonly label: string; readonly inline: PeriodLength | undefined };

const NEAR = 12;
const JA_LABEL_CHAR = /^[\p{Script=Han}\p{Script=Katakana}ー]$/u;

/** text の終わりの、漢字と片仮名の続き（「本体の保証期間」の 保証期間）。 */
const labelRunAtEnd = (text: string): string => {
  let start = text.length;
  while (start > 0 && JA_LABEL_CHAR.test(text.charAt(start - 1))) start -= 1;
  return text.slice(start);
};

/** text の終わりの語（"the free replacement " の replacement）。 */
const wordAtEnd = (text: string): string => {
  const trimmed = text.trimEnd();
  let start = trimmed.length;
  while (start > 0 && LETTER.test(trimmed.charAt(start - 1))) start -= 1;
  return trimmed.slice(start);
};
const LETTER = /\p{L}/u;
const BRACKET_PAIRS: Readonly<Record<string, string>> = { "）": "（", ")": "(" };
const MONTHS_PER_YEAR = 12;
const DAYS_PER_WEEK = 7;

const lower = (text: string): string => text.toLowerCase();
const includesWord = (text: string, words: readonly string[]): boolean => words.some((word) => word !== "" && lower(text).includes(lower(word)));

const BARE_NUMBER = /\p{Nd}$/u;

/** 幅の端（12〜18か月、12 to 18 months、12か月から18か月）。つなぐ語の向こうに数だけか、別の長さがある。 */
const isRange = (source: string, length: Span, lengths: readonly Span[], joiners: readonly string[]): boolean =>
  joiners.some((joiner) => {
    if (joiner === "") return false;
    const before = lower(source.slice(Math.max(0, length.start - NEAR), length.start).trimEnd());
    const head = before.endsWith(lower(joiner)) ? source.slice(0, length.start).trimEnd().slice(0, -joiner.length).trimEnd() : undefined;
    const opens = head !== undefined && (BARE_NUMBER.test(head) || lengths.some((other) => other.end === head.length));
    const after = source.slice(length.end, length.end + NEAR);
    const rest = after.trimStart();
    const tail = rest.slice(joiner.length);
    const tailAt = length.end + (after.length - rest.length) + joiner.length + (tail.length - tail.trimStart().length);
    const closes = lower(rest).startsWith(lower(joiner)) && lengths.some((other) => other.start === tailAt);
    return opens || closes;
  });

/** 約18か月、18か月程度、up to 18 months、12〜18か月、12 to 18 months。 */
const isRough = (source: string, length: Span, lengths: readonly Span[], words: PeriodPartWords): boolean => {
  const before = lower(source.slice(Math.max(0, length.start - NEAR), length.start).trimEnd());
  const after = lower(source.slice(length.end, length.end + NEAR).trimStart());
  const marked = words.approximate.some((word) => (word.position === "before" ? before.endsWith(lower(word.pattern)) : after.startsWith(lower(word.pattern))));
  return marked || isRange(source, length, lengths, words.rangeJoiners);
};

const within = (span: Span, outer: Span): boolean => span.start >= outer.start && span.end <= outer.end;
const lengthsIn = (lengths: readonly PeriodLength[], span: Span): PeriodLength[] => lengths.filter((length) => within(length, span));

/** 名前のすぐ前に書いた長さ（12か月の保証期間、12-month warranty period）。 */
const lengthJustBefore = (source: string, lengths: readonly PeriodLength[], at: number, joiners: readonly string[]): PeriodLength | undefined =>
  lengths.find((length) => {
    const gap = source.slice(length.end, at).trim();
    return length.end <= at && (gap === "" || joiners.includes(gap));
  });

const endsWithPeriodWord = (label: string, words: PeriodPartWords): boolean =>
  words.periodWords.some((word) => word !== "" && lower(label).endsWith(lower(word)) && label.length > word.length);

/** 括弧の始まり（「保証期間（12か月）」の （）。閉じ括弧で終わらなければ undefined。 */
const bracketStart = (source: string, start: number, end: number): number | undefined => {
  const opener = BRACKET_PAIRS[source.charAt(end - 1)];
  if (opener === undefined) return undefined;
  const at = source.lastIndexOf(opener, end - 1);
  return at >= start ? at : undefined;
};

/** 全体を印の前に書いたもの（保証期間（12か月）のうち）。名前は漢字と片仮名の続き。 */
const wholeBefore = (source: string, unit: Span, markerAt: number, lengths: readonly PeriodLength[], words: PeriodPartWords): Whole | undefined => {
  const bracket = bracketStart(source, unit.start, markerAt);
  const labelEnd = bracket ?? markerAt;
  const label = labelRunAtEnd(source.slice(unit.start, labelEnd));
  if (!endsWithPeriodWord(label, words)) return undefined;
  const labelStart = labelEnd - label.length;
  const inBracket = bracket === undefined ? [] : lengthsIn(lengths, { start: bracket, end: markerAt });
  const inline = inBracket[0] ?? lengthJustBefore(source, lengths, labelStart, words.inlineJoiners);
  return { phrase: { start: inline === undefined ? labelStart : Math.min(inline.start, labelStart), end: markerAt }, label, inline };
};

const labelPattern = (words: PeriodPartWords): RegExp => {
  const ends = words.periodWords
    .filter((word) => word !== "")
    .map(escapeRegExp)
    .join("|");
  return new RegExp(`^((?:\\p{L}+ ){0,3}?(?:${ends}))(?!\\p{L})(\\s*\\([^)]*\\))?`, "iu");
};

/** 全体を印の後ろに書いたもの（within the 12-month warranty period、within the warranty period (12 months)）。 */
const wholeAfter = (source: string, unit: Span, markerEnd: number, lengths: readonly PeriodLength[], words: PeriodPartWords): Whole | undefined => {
  const gap = source.slice(markerEnd, unit.end).length - source.slice(markerEnd, unit.end).trimStart().length;
  const lead = lengths.find((length) => length.start === markerEnd + gap);
  const afterLead = lead === undefined ? "" : source.slice(lead.end, unit.end);
  const labelAt = lead === undefined ? markerEnd + gap : lead.end + afterLead.length - afterLead.trimStart().length;
  const match = labelPattern(words).exec(source.slice(labelAt, unit.end));
  if (words.periodWords.length === 0 || match === null) return undefined;
  const end = labelAt + match[0].length;
  const inBracket = lengthsIn(lengths, { start: labelAt + (match[1] ?? "").length, end });
  return { phrase: { start: markerEnd, end }, label: match[1] ?? "", inline: lead ?? inBracket[0] };
};

const occurrences = (text: string, pattern: string): number[] => {
  const found: number[] = [];
  let at = text.indexOf(pattern);
  while (pattern !== "" && at !== -1) {
    found.push(at);
    at = text.indexOf(pattern, at + pattern.length);
  }
  return found;
};

type MarkerAt = { readonly marker: PartMarker; readonly start: number; readonly end: number };

const LATIN = /[a-z]/iu;

/** 英字の印は語の途中で切らない（within the の前後が英字なら別の語）。 */
const cutsWord = (source: string, start: number, end: number, pattern: string): boolean =>
  LATIN.test(pattern) && (LETTER.test(source.charAt(start - 1)) || LETTER.test(source.charAt(end)));

const markersIn = (source: string, unit: Span, markers: readonly PartMarker[]): MarkerAt[] => {
  const text = lower(source.slice(unit.start, unit.end));
  return markers.flatMap((marker) =>
    occurrences(text, lower(marker.pattern))
      .map((at) => ({ marker, start: unit.start + at, end: unit.start + at + marker.pattern.length }))
      .filter((found) => !cutsWord(source, found.start, found.end, marker.pattern)),
  );
};

export type PeriodPartInput = {
  readonly source: string;
  /** 文と表の行。出てくる順。 */
  readonly units: readonly Span[];
  /** 節の始まり（見出しの位置）。 */
  readonly sectionStarts: readonly number[];
  readonly lengths: readonly PeriodLength[];
  readonly words: PeriodPartWords;
};

const sectionOf = (starts: readonly number[], at: number): number => starts.filter((start) => start <= at).length;

/** 年は月に、週は日に揃える。月と日の間は月の日数が決まらないので比べない。 */
const scaleOf = (length: PeriodLength): { readonly family: string; readonly amount: number } => {
  if (length.unit === "year") return { family: "month", amount: length.amount * MONTHS_PER_YEAR };
  if (length.unit === "week") return { family: "day", amount: length.amount * DAYS_PER_WEEK };
  return { family: length.unit, amount: length.amount };
};

const isLonger = (part: PeriodLength, whole: PeriodLength): boolean => {
  const [left, right] = [scaleOf(part), scaleOf(whole)];
  return left.family === right.family && left.amount > right.amount;
};

/** 名前の前が同じ語の続き（無料修理期間の 修理期間、extended warranty period）なら、別の期間の名前。 */
const isWholeName = (source: string, at: number, label: string, words: PeriodPartWords): boolean => {
  const before = source.charAt(at - 1);
  const joined = JA_LABEL_CHAR.test(before) && JA_LABEL_CHAR.test(label.charAt(0));
  const inWord = LETTER.test(before) && LATIN.test(label.charAt(0));
  return !joined && !inWord && !includesWord(source.slice(Math.max(0, at - NEAR), at), words.afterWords);
};

/** 一つの文か行で、全体の名前の後ろに書いた長さ。名前の後ろに長さが一つだけのとき。 */
const statedLength = (input: PeriodPartInput, unit: Span, label: string): PeriodLength | undefined => {
  const { source, lengths, words } = input;
  const named = occurrences(lower(source.slice(unit.start, unit.end)), lower(label))
    .map((at) => unit.start + at)
    .find((at) => isWholeName(source, at, label, words));
  if (named === undefined) return undefined;
  const after = lengthsIn(lengths, { start: named + label.length, end: unit.end });
  const [only] = after;
  return after.length === 1 && only !== undefined && !isRough(source, only, lengths, words) ? only : undefined;
};

/** the warranty runs for 12 months: 名前から期間の語を除いた語、長さを言う語、長さが続けて並ぶ。 */
const verbLength = (input: PeriodPartInput, unit: Span, label: string): PeriodLength | undefined => {
  const { source, lengths, words } = input;
  const end = words.periodWords.find((word) => lower(label).endsWith(lower(word)));
  const stem = end === undefined ? "" : label.slice(0, -end.length).trim();
  if (stem === "") return undefined;
  const text = lower(source.slice(unit.start, unit.end));
  return words.lengthVerbs.flatMap((verb) => {
    const phrase = lower(`${stem} ${verb}`);
    return occurrences(text, phrase).flatMap((at) => {
      const from = unit.start + at + phrase.length;
      const next = lengths.find((length) => length.start >= from && source.slice(from, length.start).trim() === "");
      return next === undefined || isRough(source, next, lengths, words) ? [] : [next];
    });
  })[0];
};

const hasMarker = (input: PeriodPartInput, unit: Span): boolean => markersIn(input.source, unit, input.words.markers).length > 0;

/** 同じ節で全体の名前に書いた長さ。違う長さが並べば一番長いもの（どれより長いときだけ言う）。 */
const wholeInSection = (input: PeriodPartInput, current: Span, label: string): PeriodLength[] => {
  const section = sectionOf(input.sectionStarts, current.start);
  return input.units
    .filter((unit) => unit !== current && sectionOf(input.sectionStarts, unit.start) === section && !hasMarker(input, unit))
    .flatMap((unit) => {
      const stated = statedLength(input, unit, label) ?? verbLength(input, unit, label);
      return stated === undefined ? [] : [stated];
    });
};

/** このうち: すぐ前の文が、期間の語と長さ一つを持つとき、その長さ。 */
const previousWhole = (input: PeriodPartInput, index: number): PeriodLength[] => {
  const [previous, current] = [input.units[index - 1], input.units[index]];
  if (previous === undefined || current === undefined) return [];
  if (sectionOf(input.sectionStarts, previous.start) !== sectionOf(input.sectionStarts, current.start)) return [];
  const inPrevious = lengthsIn(input.lengths, previous);
  const [only] = inPrevious;
  const named = includesWord(input.source.slice(previous.start, previous.end), input.words.periodWords);
  return inPrevious.length === 1 && only !== undefined && named && !isRough(input.source, only, input.lengths, input.words) ? [only] : [];
};

const wholeOf = (input: PeriodPartInput, unit: Span, found: MarkerAt): Whole | undefined =>
  found.marker.position === "after"
    ? wholeBefore(input.source, unit, found.start, input.lengths, input.words)
    : wholeAfter(input.source, unit, found.end, input.lengths, input.words);

/** 名前の付いた期間（無料交換期間、the free replacement period）。the period of 21 days のような名前の無い期間は部分と読まない。 */
const namesPeriod = (text: string, words: PeriodPartWords): boolean =>
  words.periodWords.some((word) =>
    occurrences(lower(text), lower(word)).some((at) => {
      if (LATIN.test(word)) {
        const before = wordAtEnd(text.slice(0, at));
        return before !== "" && !LETTER.test(text.charAt(at - 1)) && !words.unnamed.some((unnamed) => lower(unnamed) === lower(before));
      }
      return JA_LABEL_CHAR.test(text.charAt(at - 1));
    }),
  );

/** 部分の長さ: 全体の句の外に長さがちょうど一つ。adjacent の印では印のすぐ前、他は全体の外に期間の語があること。 */
const partOf = (input: PeriodPartInput, unit: Span, phrase: Span, found: MarkerAt): PeriodLength | undefined => {
  const { source, words } = input;
  const outside = lengthsIn(input.lengths, unit).filter((length) => length.end <= phrase.start || length.start >= phrase.end);
  const [part] = outside;
  if (outside.length !== 1 || part === undefined || isRough(source, part, input.lengths, words)) return undefined;
  if (found.marker.group === ADJACENT) return source.slice(part.end, found.start).trim() === "" ? part : undefined;
  const rest = source.slice(unit.start, phrase.start) + source.slice(phrase.end, unit.end);
  return namesPeriod(rest, words) ? part : undefined;
};

const issuesAt = (input: PeriodPartInput, index: number, found: MarkerAt): PeriodPartIssue[] => {
  const unit = input.units[index];
  if (unit === undefined) return [];
  const anaphor = found.marker.group === ANAPHOR;
  const whole = anaphor ? { phrase: { start: found.start, end: found.end }, label: "", inline: undefined } : wholeOf(input, unit, found);
  if (whole === undefined) return [];
  const part = partOf(input, unit, whole.phrase, found);
  if (part === undefined) return [];
  const inlineWholes = whole.inline === undefined || isRough(input.source, whole.inline, input.lengths, input.words) ? [] : [whole.inline];
  const named = whole.inline === undefined ? wholeInSection(input, unit, whole.label) : inlineWholes;
  const wholes = anaphor ? previousWhole(input, index) : named;
  const [first] = wholes;
  if (first === undefined || !wholes.every((candidate) => isLonger(part, candidate))) return [];
  const longest = wholes.reduce((left, right) => (scaleOf(right).amount > scaleOf(left).amount ? right : left), first);
  return [{ part, whole: longest }];
};

/** 全体より長い部分の期間。一つの文に印が二つあっても、言うのは一度。 */
export const periodPartIssues = (input: PeriodPartInput): PeriodPartIssue[] =>
  input.units.flatMap((unit, index) => {
    if (includesWord(input.source.slice(unit.start, unit.end), input.words.afterWords)) return [];
    const [issue] = markersIn(input.source, unit, input.words.markers).flatMap((found) => issuesAt(input, index, found));
    return issue === undefined ? [] : [issue];
  });

const TABLE_ROW = /^\s*\|.*\|\s*$/u;
const TABLE_RULE = /^[\s|:-]+$/u;

const LINE = /^[^\n]*$/gmu;

/** 表の行（| 保証期間 | 1年 |）。区切りの行は除く。 */
export const tableRowsOf = (source: string): Span[] =>
  [...source.matchAll(LINE)].flatMap((line) =>
    TABLE_ROW.test(line[0]) && !TABLE_RULE.test(line[0]) ? [{ start: line.index, end: line.index + line[0].length }] : [],
  );
