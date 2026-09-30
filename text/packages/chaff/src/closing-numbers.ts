import { calendarRuns, digitRuns, type CalendarUnits } from "./calendar-number.ts";
import type { ProseDocument, Section, Sentence, Span } from "./plugin.ts";

/** 文書の一続きの文字列と、その中の文。base は text の先頭の位置で、文の span は文書全体の座標。 */
export type Passage = { readonly text: string; readonly base: number; readonly sentences: readonly Sentence[] };

/** 結びの節と、それより前の文書全体（見出し・表・コードも）。 */
export const closingAndEarlier = (doc: ProseDocument, last: Section): { closing: Passage; earlier: Passage } => ({
  closing: { text: doc.source.slice(last.span.start, last.span.end), base: last.span.start, sentences: last.sentences },
  earlier: { text: doc.source.slice(0, last.span.start), base: 0, sentences: doc.sentences.filter((sentence) => sentence.span.end <= last.span.start) },
});

const DIGIT = /\d/u;

/** 最後の数字まで。文末の「412.」の点や、範囲の「3-」のハイフンは数の一部ではない。前のハイフンは符号（-1%）なので残す。 */
const valueOf = (text: string, run: Span): string => {
  const raw = text.slice(run.start, run.end);
  const lastDigit = [...raw].findLastIndex((char) => DIGIT.test(char));
  return raw.slice(0, lastDigit + 1);
};

/** passage の中で、品詞の付いた文の字。見出しや表の字は文ではないので付かない。 */
const taggedChars = (passage: Passage): Uint8Array => {
  const tagged = new Uint8Array(passage.text.length);
  passage.sentences
    .filter((sentence) => sentence.tokens !== undefined)
    .forEach((sentence) => tagged.fill(1, Math.max(0, sentence.span.start - passage.base), Math.max(0, sentence.span.end - passage.base)));
  return tagged;
};

/** 文の中の日付・時刻の数の単位を、passage の中の位置で。文ごとに読むので、長い文書でも語を探す範囲は文の中だけ。 */
const calendarUnitsAt = (passage: Passage, units: CalendarUnits): ReadonlyMap<number, string> =>
  new Map(
    passage.sentences.flatMap((sentence) =>
      calendarRuns(sentence.text, sentence.tokens, sentence.span.start, units).map(({ run, unit }): [number, string] => [
        sentence.span.start - passage.base + run.start,
        unit,
      ]),
    ),
  );

/** 品詞の無いところの数の、すぐ後ろ（空白 1 つまで）に字面で続く日付・時刻の単位のうち、いちばん長いもの。無ければ空。 */
const unitAsWritten = (text: string, run: Span, units: CalendarUnits): string => {
  const at = text[run.end] === " " ? run.end + 1 : run.end;
  const following = [...units.chained, ...units.positional, ...units.year].filter((unit) => text.startsWith(unit, at));
  return following.reduce((longest, unit) => (unit.length > longest.length ? unit : longest), "");
};

/**
 * passage の中の数の、比べるときの名前を左から。日付・時刻の数は単位ごと（9月）、それ以外は数そのもの（412）。
 * 文の中は品詞で見分ける（calendar-number.ts）。見出しや表は品詞が無いので、数の後ろの字で見分ける（題の「9月の報告」）。
 */
const numberKeys = (passage: Passage, units: CalendarUnits): string[] => {
  const unitAt = calendarUnitsAt(passage, units);
  const tagged = taggedChars(passage);
  return digitRuns(passage.text).map((run) => {
    const value = valueOf(passage.text, run);
    const firstDigit = run.start + passage.text.slice(run.start, run.end).search(DIGIT);
    const unit = tagged[firstDigit] === 1 ? (unitAt.get(run.start) ?? "") : unitAsWritten(passage.text, run, units);
    return `${value}${unit}`;
  });
};

/**
 * 結びの数のうち、それより前（見出し・表も）に書いていないもの（重ならないように、書いた順）。
 * 前に同じ名前で書いた数（題の「9月」と結びの「9月」、本文の「412 件」と結びの「412 件」）は新しくない。
 * 日付・時刻と数量は別のもので、本文の「9 件」があっても結びの「9月末」は新しく、題の「9月」があっても結びの「9 件」は新しい。
 */
export const newNumbers = (closing: Passage, earlier: Passage, units: CalendarUnits): string[] => {
  const stated = new Set(numberKeys(earlier, units));
  return [...new Set(numberKeys(closing, units).filter((key) => !stated.has(key)))];
};
