import { sameValue, type FactValue } from "./fact-values.ts";
import type { Fact } from "./labelled-facts.ts";
import type { TermWord } from "./document-terms.ts";
import { withoutEdgeMarks } from "./trim-marks.ts";

/**
 * 文書全体で一つの値を持つ項目（保証期間、warranty period）を主語にした文の期間。名前付きの値の読み（labelled-facts）は、区切りの
 * すぐ後ろで文が終わる値だけを読むので、起算の句の付いた値（「保証期間は、お買い上げ日から24か月です」"The warranty period is
 * 24 months from the date of purchase"）と、名前の後ろの括弧の値（「保証期間（12か月）のうち」）はここで読む。語彙表の名前が主語
 * のときだけ読む: 「無料交換期間は、お買い上げ日から18か月です」は主語が違う。前に条件の句がある文（「製品登録をされた場合、」）は
 * 読まない。条件の句が起算の日付だけを書いた例（「お買い上げ日が2026年7月1日の場合、保証期間は2026年7月1日から12か月」）は読む:
 * 起算の日を決めるだけで、長さを変えない。
 */
export type PlacedWord = { readonly pattern: string; readonly position: "before" | "after" };

export type TermValueWords = {
  readonly terms: readonly TermWord[];
  /** 名前と値の区切り（は、is）と、項目の長さを言う動詞（runs for、lasts）。 */
  readonly separators: readonly string[];
  /** 名前の頭から落とす語（the、本体の）。 */
  readonly determiners: readonly string[];
  /** 文書が説明しているもの自身を指す、名前に付いた語（本製品の、for the product）。付いていても同じ項目。 */
  readonly selves: readonly PlacedWord[];
  /** 起算の句の印（から は値の前の句の終わり、from は値の後ろの句の頭）。 */
  readonly starts: readonly PlacedWord[];
  readonly valueEnds: readonly string[];
};

const folded = (text: string): string => text.normalize("NFKC").toLowerCase().replace(/\s+/gu, " ").trim();

const SENTENCE_BREAK = /[。！？!?|．]|\.(?=\s)/gu;
const BLOCK_MARK = /^[ \t]*(?:#{1,6}[ \t]+|>[ \t]?)?/u;
const ITEM_MARK = /^[-*+][ \t]+/u;
const CLAUSE_COMMAS = /[、，,]/gu;
const CLAUSE_COMMA = /[、，,]/u;
const LATIN_WORD = /^[a-z ]+$/iu;
const OPEN_BRACKETS = ["（", "("];
const CLOSE_BRACKETS = ["）", ")"];
/** 起算の句の長さの上限。長い句は、ほかの条件を含むことがある。 */
const MAX_START_PHRASE = 32;
const PHRASE_STOPS = new Set([".", ",", ";", "(", "（", "、", "。"]);

const lineStartOf = (source: string, offset: number): number => source.lastIndexOf("\n", offset - 1) + 1;

const lineEndOf = (source: string, offset: number): number => {
  const end = source.indexOf("\n", offset);
  return end === -1 ? source.length : end;
};

/** 値の前の、文の頭からの位置。 */
const clauseStartOf = (source: string, offset: number): number => {
  const lineStart = lineStartOf(source, offset);
  const breaks = [...source.slice(lineStart, offset).matchAll(SENTENCE_BREAK)];
  const last = breaks.at(-1);
  const start = last === undefined ? lineStart : lineStart + last.index + last[0].length;
  const block = BLOCK_MARK.exec(source.slice(start, offset))?.[0].length ?? 0;
  const item = ITEM_MARK.exec(source.slice(start + block, offset))?.[0].length ?? 0;
  return start + block + item;
};

const withoutDeterminer = (key: string, words: TermValueWords): string => {
  const [first, ...rest] = key.split(" ");
  const latin = words.determiners.map(folded).filter((word) => LATIN_WORD.test(word));
  if (rest.length > 0 && latin.includes(first ?? "")) return rest.join(" ");
  const prefix = words.determiners.map(folded).find((word) => !LATIN_WORD.test(word) && key.length > word.length && key.startsWith(word));
  return prefix === undefined ? key : key.slice(prefix.length);
};

const withoutSelf = (key: string, words: TermValueWords): string => {
  const self = words.selves.find((word) => (word.position === "before" ? key.startsWith(folded(word.pattern)) : key.endsWith(` ${folded(word.pattern)}`)));
  if (self === undefined) return key;
  const length = folded(self.pattern).length;
  return (self.position === "before" ? key.slice(length) : key.slice(0, key.length - length)).trim();
};

/** 名前が語彙表の項目なら、その語の形。 */
export const termKeyOf = (label: string, words: TermValueWords): string | undefined => {
  const key = withoutSelf(withoutDeterminer(folded(withoutEdgeMarks(label)), words), words);
  return words.terms.map((word) => folded(word.pattern)).find((pattern) => pattern === key);
};

type Span = { readonly start: number; readonly end: number };

const valuesIn = (values: readonly FactValue[], span: Span): FactValue[] => values.filter((value) => span.start <= value.start && value.end <= span.end);

const isLatin = (word: string): boolean => LATIN_WORD.test(word);

/** 区切りの位置。英字の区切りは前後が空白。 */
const separatorsIn = (text: string, separator: string): number[] =>
  [...text.matchAll(new RegExp(separator.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "giu"))]
    .map((match) => match.index)
    .filter((index) => !isLatin(separator) || (text.charAt(index - 1) === " " && [" ", ""].includes(text.charAt(index + separator.length))));

type Subject = { readonly key: string; readonly label: string; readonly lead: Span | undefined; readonly restStart: number };

/** 文の頭から区切りまでの主語。読点の前は条件の句。 */
const subjectOf = (source: string, from: number, to: number, words: TermValueWords): Subject | undefined => {
  const clause = source.slice(from, to);
  for (const separator of words.separators.toSorted((left, right) => right.length - left.length)) {
    for (const index of separatorsIn(clause, separator)) {
      const head = clause.slice(0, index);
      const comma = [...head.matchAll(CLAUSE_COMMAS)].at(-1)?.index;
      const label = withoutEdgeMarks(comma === undefined ? head : head.slice(comma + 1));
      const key = termKeyOf(label, words);
      if (key === undefined) continue;
      return { key, label, lead: comma === undefined ? undefined : { start: from, end: from + comma }, restStart: from + index + separator.length };
    }
  }
  return undefined;
};

const startsBefore = (words: TermValueWords): string[] => words.starts.filter((word) => word.position === "before").map((word) => word.pattern);
const startsAfter = (words: TermValueWords): string[] => words.starts.filter((word) => word.position === "after").map((word) => word.pattern);

/** 区切りと値のあいだ。空か、起算の句（お買い上げ日から）。句の中の値は日付だけ。 */
const startBeforeValue = (source: string, span: Span, values: readonly FactValue[], words: TermValueWords): Span | undefined => {
  const rest = source.slice(span.start, span.end).replace(/^[、，\s]+/u, "");
  if (rest === "") return { start: span.end, end: span.end };
  const phraseStart = span.end - rest.length;
  const inside = rest.split("").some((char) => PHRASE_STOPS.has(char));
  const marked = startsBefore(words).some((mark) => rest.endsWith(mark));
  if (!marked || inside || rest.length > MAX_START_PHRASE) return undefined;
  const phrase = { start: phraseStart, end: span.end };
  return valuesIn(values, phrase).every((value) => value.kind === "date") ? phrase : undefined;
};

const insideDate = (offset: number, dates: readonly FactValue[]): boolean => dates.some((date) => date.start <= offset && offset < date.end);

/** 値の後ろの起算の句（from the date of purchase）の終わり。日付の中の , は句の切れ目ではない。 */
const startAfterValue = (source: string, at: number, values: readonly FactValue[], words: TermValueWords): Span => {
  const lineEnd = lineEndOf(source, at);
  const mark = startsAfter(words).find((word) => source.slice(at, at + word.length + 2).toLowerCase() === ` ${word.toLowerCase()} `);
  if (mark === undefined) return { start: at, end: at };
  const dates = values.filter((value) => value.kind === "date");
  const from = at + mark.length + 2;
  const stop = source
    .slice(from, lineEnd)
    .split("")
    .findIndex((char, index) => PHRASE_STOPS.has(char) && !insideDate(from + index, dates));
  const end = stop === -1 ? lineEnd : from + stop;
  const trimmed = source.slice(at, end).trimEnd().length;
  return end - at > MAX_START_PHRASE + mark.length ? { start: at, end: at } : { start: at, end: at + trimmed };
};

/** 括弧の中の補い（（2027年7月31日まで））の後ろ。括弧が無ければそのまま。 */
const afterParenthesis = (source: string, at: number): number => {
  const gap = source.charAt(at) === " " ? 1 : 0;
  const open = OPEN_BRACKETS.indexOf(source.charAt(at + gap));
  if (open === -1) return at;
  const close = source.indexOf(CLOSE_BRACKETS[open] ?? ")", at + gap + 1);
  return close === -1 || close > lineEndOf(source, at) ? at : close + 1;
};

const endsSentence = (source: string, at: number, words: TermValueWords): boolean => {
  const after = source.slice(at, lineEndOf(source, at)).trimStart();
  return after === "" || after.startsWith("|") || words.valueEnds.some((end) => after.startsWith(end));
};

/** 条件の句が、起算の日付と同じ日付だけを書いた例か。 */
const isWorkedExample = (lead: Span, starts: readonly Span[], values: readonly FactValue[]): boolean => {
  const [date, ...others] = valuesIn(values, lead);
  if (date === undefined || others.length > 0 || date.kind !== "date") return false;
  return starts.some((span) => valuesIn(values, span).some((value) => value.kind === "date" && sameValue(date, value)));
};

/** 主語と区切りの後ろの期間（保証期間は、お買い上げ日から24か月です）。 */
const subjectFact = (source: string, value: FactValue, values: readonly FactValue[], words: TermValueWords): Fact | undefined => {
  const subject = subjectOf(source, clauseStartOf(source, value.start), value.start, words);
  if (subject === undefined) return undefined;
  const before = startBeforeValue(source, { start: subject.restStart, end: value.start }, values, words);
  if (before === undefined) return undefined;
  const after = startAfterValue(source, value.end, values, words);
  if (!endsSentence(source, afterParenthesis(source, after.end), words)) return undefined;
  if (subject.lead !== undefined && !isWorkedExample(subject.lead, [before, after], values)) return undefined;
  return { label: subject.label, key: subject.key, value };
};

/** 名前のすぐ後ろの括弧の中の期間（保証期間（12か月）、warranty period (12 months)）。 */
const bracketFact = (source: string, value: FactValue, words: TermValueWords): Fact | undefined => {
  const open = OPEN_BRACKETS.indexOf(source.charAt(value.start - 1));
  if (open === -1 || source.charAt(value.end) !== CLOSE_BRACKETS[open]) return undefined;
  const from = clauseStartOf(source, value.start);
  const label = withoutEdgeMarks(source.slice(from, value.start - 1));
  if (CLAUSE_COMMA.test(label)) return undefined;
  const key = termKeyOf(label, words);
  return key === undefined ? undefined : { label, key, value };
};

const DURATION_UNITS = new Set(["day", "week", "month", "year"]);

/** 語彙表の項目を主語にした文の、期間の値。values は文書の中の順の値（日付を含む）。 */
export const termValues = (source: string, values: readonly FactValue[], words: TermValueWords): Fact[] =>
  values
    .filter((value) => value.kind === "quantity" && DURATION_UNITS.has(value.unit))
    .flatMap((value) => {
      const fact = bracketFact(source, value, words) ?? subjectFact(source, value, values, words);
      return fact === undefined ? [] : [fact];
    });
