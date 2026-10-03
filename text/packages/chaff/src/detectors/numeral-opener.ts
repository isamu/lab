import type { Detector, Finding, Sentence, Span } from "../plugin.ts";

/**
 * 数字で始まる文（20 people came.）。読み手は文の頭を大文字で探すので、数字の頭は文の切れ目を見えにくくする。
 * 数字の後ろが小文字の語のときだけ読む: 「1 Introduction」のような番号の付いた題や「9:00 Opening」のような時刻の行は文ではない。
 * 年（2026 was a good year.）は綴れないので読まない。
 */

const OPENING_NUMERAL = /^(?<numeral>\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?%?(?=\s+\p{Ll})/u;
const SENTENCE_END = /[.!?]["'”’)]*$/u;
const YEAR = /^[12]\d{3}$/u;
const HEADING_LINE = /(?:^|\n)#{1,6}\s[^\n]*$/u;
/** 前の文の終わりの語と、その後ろの終わりの印。 */
const LAST_WORD = /(?<word>[\p{L}\p{N}.]+)[.!?]["'”’)]*$/u;
const DIGITS = /^\d+$/u;
/** 前の文の終わりを探す字数。見出しの行と、終わりの語が入れば足りる。 */
const LOOKBACK = 300;
const PLAIN_WORD = /^\p{L}{2,}$/u;

/** 文の頭の数字。年、数字の後ろが小文字の語でないもの、言い終えていない行（見出しのような）は無い。 */
export const openingNumeral = (text: string): string | undefined => {
  const trimmed = text.trim();
  const match = OPENING_NUMERAL.exec(trimmed);
  const numeral = match?.groups?.["numeral"];
  if (match === null || numeral === undefined || YEAR.test(numeral) || !SENTENCE_END.test(trimmed)) return undefined;
  return match[0];
};

/**
 * offset の前で、文がほんとうに終わっているか。文書か見出しの直後か、前の文が二字以上の語か数で言い終えているときだけ。
 * 番号に付ける略した語（vol. 28、H.R. 5376）や、句点の無い行（Lane\n\n2 contains、HTML から移したリンクの切れ目）の後ろの数は文の頭ではない。
 */
export const followsSentenceEnd = (source: string, offset: number, labels: ReadonlySet<string>): boolean => {
  const from = Math.max(0, offset - LOOKBACK);
  const ended = source.slice(from, offset).trimEnd();
  if ((ended === "" && from === 0) || HEADING_LINE.test(ended)) return true;
  const word = LAST_WORD.exec(ended)?.groups?.["word"];
  if (word === undefined) return false;
  return DIGITS.test(word) || (PLAIN_WORD.test(word) && !labels.has(word.toLowerCase()));
};

const inside = (spans: readonly Span[], offset: number): boolean => spans.some((span) => span.start <= offset && offset < span.end);

const leadingSpace = (sentence: Sentence): number => sentence.text.length - sentence.text.trimStart().length;

export const numeralOpener: Detector = (doc): Finding[] => {
  const labels = new Set((doc.lexicons["numeral-reference-label"] ?? []).map((entry) => entry.pattern.toLowerCase()));
  return doc.sentences.flatMap((sentence) => {
    const offset = sentence.span.start + leadingSpace(sentence);
    if (sentence.embeddedLanguage !== undefined || inside(doc.listSpans, offset)) return [];
    const numeral = openingNumeral(sentence.text);
    if (numeral === undefined || !followsSentenceEnd(doc.source, offset, labels)) return [];
    return [{ rule: "", severity: "warning", line: 0, column: 0, quote: sentence.text.trim(), values: { numeral, offset } }];
  });
};
