import { sameValue, type FactValue } from "./fact-values.ts";
import type { Fact } from "./labelled-facts.ts";
import type { TermWord } from "./document-terms.ts";
import { withoutEdgeMarks } from "./trim-marks.ts";
import { qualifiedKeyOf, type QualifierWords } from "./qualified-labels.ts";

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
  /** 名前のすぐ後ろで、その値を何に使ったかを言う分詞（used、applied）。後ろの句ごと落としても同じ項目。 */
  readonly restating?: readonly string[];
  /** 名前と値を囲む型（を*として）。* が値。型の値は、期間でなくても読む。 */
  readonly frames?: readonly string[];
  /** 文の値に条件を付ける語（場合、if）。型の前の句にあれば読まない。 */
  readonly conditions?: readonly string[];
  /** 名前に条件を付ける型（*の、for *）。 */
  readonly qualifiers?: QualifierWords;
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
export const clauseStartOf = (source: string, offset: number): number => {
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

/** 語彙表の項目の形。語彙表の語は条件の付いた名前の形（扶養親族の数 は 数 (扶養親族)）なので、名前もその形にして比べる。 */
const termOf = (key: string, words: TermValueWords): string | undefined => {
  const qualified = words.qualifiers === undefined ? key : qualifiedKeyOf(key, words.qualifiers);
  return words.terms.map((word) => folded(word.pattern)).find((pattern) => pattern === key || pattern === qualified);
};

/** 何に使ったかを言う分詞から後ろを落とした名前（number of dependants used for the allowance の number of dependants）。 */
const withoutRestating = (key: string, words: TermValueWords): string | undefined =>
  (words.restating ?? [])
    .flatMap((word) => {
      const mark = ` ${folded(word)}`;
      const at = key.indexOf(mark);
      const next = key.charAt(at + mark.length);
      return at > 0 && (next === "" || next === " ") ? [key.slice(0, at)] : [];
    })
    .find((head) => termOf(head, words) !== undefined);

/** 名前が語彙表の項目なら、その語の形。restated: 何に使ったかを言う句を落として、項目になった。 */
const termKeyWith = (label: string, words: TermValueWords): { readonly key: string; readonly restated: boolean } | undefined => {
  const key = withoutSelf(withoutDeterminer(folded(withoutEdgeMarks(label)), words), words);
  const term = termOf(key, words);
  if (term !== undefined) return { key: term, restated: false };
  const restated = withoutRestating(key, words);
  return restated === undefined ? undefined : { key: restated, restated: true };
};

/** 名前が語彙表の項目なら、その語の形。 */
export const termKeyOf = (label: string, words: TermValueWords): string | undefined => termKeyWith(label, words)?.key;

type Span = { readonly start: number; readonly end: number };

const valuesIn = (values: readonly FactValue[], span: Span): FactValue[] => values.filter((value) => span.start <= value.start && value.end <= span.end);

const isLatin = (word: string): boolean => LATIN_WORD.test(word);

/** 区切りの位置。英字の区切りは前後が空白。 */
const separatorsIn = (text: string, separator: string): number[] =>
  [...text.matchAll(new RegExp(separator.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "giu"))]
    .map((match) => match.index)
    .filter((index) => !isLatin(separator) || (text.charAt(index - 1) === " " && [" ", ""].includes(text.charAt(index + separator.length))));

type Subject = { readonly key: string; readonly label: string; readonly lead: Span | undefined; readonly restStart: number; readonly restated: boolean };

/** 文の頭から区切りまでの主語。読点の前は条件の句。 */
const subjectOf = (source: string, from: number, to: number, words: TermValueWords): Subject | undefined => {
  const clause = source.slice(from, to);
  for (const separator of words.separators.toSorted((left, right) => right.length - left.length)) {
    for (const index of separatorsIn(clause, separator)) {
      const head = clause.slice(0, index);
      const comma = [...head.matchAll(CLAUSE_COMMAS)].at(-1)?.index;
      const label = withoutEdgeMarks(comma === undefined ? head : head.slice(comma + 1));
      const term = termKeyWith(label, words);
      if (term === undefined) continue;
      const lead = comma === undefined ? undefined : { start: from, end: from + comma };
      return { ...term, label, lead, restStart: from + index + separator.length };
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

/**
 * 括弧の中の終わりの日付（（2027年7月31日まで）、(until July 31, 2027)）の後ろ。日付の無い括弧（(if registered)）は条件なので、
 * 飛ばさずに文の終わりでないとする。括弧が無ければそのまま。
 */
const afterEndDate = (source: string, at: number, values: readonly FactValue[]): number => {
  const gap = source.charAt(at) === " " ? 1 : 0;
  const open = OPEN_BRACKETS.indexOf(source.charAt(at + gap));
  if (open === -1) return at;
  const close = source.indexOf(CLOSE_BRACKETS[open] ?? ")", at + gap + 1);
  if (close === -1 || close > lineEndOf(source, at)) return at;
  const inside = valuesIn(values, { start: at + gap, end: close });
  return inside.length > 0 && inside.every((value) => value.kind === "date") ? close + 1 : at;
};

/** 値の後ろが文の終わりか。読点の後ろは条件が続くことがある（, if you register）ので、終わりとしない。 */
const endsSentence = (source: string, at: number, words: TermValueWords): boolean => {
  const after = source.slice(at, lineEndOf(source, at)).trimStart();
  const ends = words.valueEnds.filter((end) => !CLAUSE_COMMA.test(end));
  return after === "" || after.startsWith("|") || ends.some((end) => after.startsWith(end));
};

/** 条件の句が、起算の日付と同じ日付だけを書いた例か。 */
const isWorkedExample = (lead: Span, starts: readonly Span[], values: readonly FactValue[]): boolean => {
  const [date, ...others] = valuesIn(values, lead);
  if (date === undefined || others.length > 0 || date.kind !== "date") return false;
  return starts.some((span) => valuesIn(values, span).some((value) => value.kind === "date" && sameValue(date, value)));
};

/** 主語と区切りの後ろの期間（保証期間は、お買い上げ日から24か月です）。restatedOnly: 何に使ったかを言う句の付いた主語だけ。 */
const subjectFact = (source: string, value: FactValue, values: readonly FactValue[], words: TermValueWords, restatedOnly = false): Fact | undefined => {
  const subject = subjectOf(source, clauseStartOf(source, value.start), value.start, words);
  if (subject === undefined || (restatedOnly && !subject.restated)) return undefined;
  const before = startBeforeValue(source, { start: subject.restStart, end: value.start }, values, words);
  if (before === undefined) return undefined;
  const after = startAfterValue(source, value.end, values, words);
  if (!endsSentence(source, afterEndDate(source, after.end, values), words)) return undefined;
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

const NUMBER_HEAD = /^[\d.,]+[ \t]*/u;

/** 区切りの前の主語（This stay was の This stay）。文の頭が区切りで終わらなければ無い。 */
const subjectBeforeSeparator = (clause: string, words: TermValueWords): string | undefined => {
  const separator = words.separators.find((written) => separatorsIn(clause, written).some((index) => index + written.length === clause.length));
  return separator === undefined ? undefined : clause.slice(0, clause.length - separator.length).trim();
};

/** 冠詞と一語だけの主語（This stay、The stay）。Previous stay、The previous stay は別のものを指すことがあるので読まない。 */
const isBareSubject = (subject: string, words: TermValueWords): boolean => {
  const [determiner, noun, ...rest] = folded(subject).split(" ");
  const latin = words.determiners.map(folded).filter((word) => LATIN_WORD.test(word));
  return noun !== undefined && rest.length === 0 && latin.includes(determiner ?? "");
};

/**
 * 単位の語から項目の名前を書いた値（This stay was 6 days in hospital.）。名前が値の単位から始まり、その後ろで文が終わり、値の前が
 * 冠詞と一語の主語と区切りだけのときだけ。条件の句（after 3 days in hospital）や読点の前の句の値は読まない。
 */
const unitNamedFact = (source: string, value: FactValue, words: TermValueWords): Fact | undefined => {
  const unitStart = value.start + (NUMBER_HEAD.exec(source.slice(value.start, value.end))?.[0].length ?? 0);
  const clause = source.slice(clauseStartOf(source, value.start), value.start).trimEnd();
  const subject = CLAUSE_COMMA.test(clause) ? undefined : subjectBeforeSeparator(clause, words);
  if (unitStart >= value.end || subject === undefined || !isBareSubject(subject, words)) return undefined;
  const term = words.terms.find((word) => {
    const end = unitStart + word.pattern.length;
    return end > value.end && folded(source.slice(unitStart, end)) === folded(word.pattern) && endsSentence(source, end, words);
  });
  return term === undefined ? undefined : { label: source.slice(unitStart, unitStart + term.pattern.length), key: folded(term.pattern), value };
};

const DURATION_UNITS = new Set(["day", "week", "month", "year"]);

/** 型の前と後ろの字（を*として の を と として）。 */
const frameParts = (frame: string): readonly [string, string] | undefined => {
  const at = frame.indexOf("*");
  return at <= 0 || at === frame.length - 1 ? undefined : [frame.slice(0, at), frame.slice(at + 1)];
};

/** 型の前の句（扶養控除は、）が、値も条件の語も含まないか。条件の句（登録された場合、）の後ろの値は、その場合の値。 */
const isPlainLead = (source: string, lead: Span, values: readonly FactValue[], words: TermValueWords): boolean => {
  const written = folded(source.slice(lead.start, lead.end));
  return valuesIn(values, lead).length === 0 && !(words.conditions ?? []).some((word) => written.includes(folded(word)));
};

/** 型の名前（扶養親族の数を2人として の 扶養親族の数）。名前は読点の後ろから。 */
const framedFact = (
  source: string,
  value: FactValue,
  values: readonly FactValue[],
  words: TermValueWords,
  [open, close]: readonly [string, string],
): Fact | undefined => {
  const from = clauseStartOf(source, value.start);
  const labelEnd = value.start - open.length;
  if (labelEnd <= from || source.slice(labelEnd, value.start) !== open || !source.startsWith(close, value.end)) return undefined;
  const head = source.slice(from, labelEnd);
  const comma = [...head.matchAll(CLAUSE_COMMAS)].at(-1)?.index ?? -1;
  const label = withoutEdgeMarks(head.slice(comma + 1));
  const key = termKeyOf(label, words);
  if (key === undefined || !isPlainLead(source, { start: from, end: from + Math.max(comma, 0) }, values, words)) return undefined;
  return { label, key, value };
};

/** 名前と値を囲む型の値（扶養控除は、扶養親族の数を2人として計算しています）。 */
const frameFact = (source: string, value: FactValue, values: readonly FactValue[], words: TermValueWords): Fact | undefined =>
  (words.frames ?? [])
    .flatMap((frame) => {
      const parts = frameParts(frame);
      const fact = parts === undefined ? undefined : framedFact(source, value, values, words, parts);
      return fact === undefined ? [] : [fact];
    })
    .at(0);

const durationFact = (source: string, value: FactValue, values: readonly FactValue[], words: TermValueWords): Fact | undefined =>
  bracketFact(source, value, words) ?? subjectFact(source, value, values, words) ?? unitNamedFact(source, value, words);

/**
 * 語彙表の項目を主語にした文の、期間の値。期間でない数は、何に使ったかを言う句の付いた主語（the number of dependants used for the
 * allowance is 2）か、名前と値を囲む型（扶養親族の数を2人として）のときだけ。values は文書の中の順の値（日付を含む）。
 */
export const termValues = (source: string, values: readonly FactValue[], words: TermValueWords): Fact[] =>
  values
    .filter((value) => value.kind === "quantity")
    .flatMap((value) => {
      const read = DURATION_UNITS.has(value.unit) ? durationFact(source, value, values, words) : subjectFact(source, value, values, words, true);
      const fact = read ?? frameFact(source, value, values, words);
      return fact === undefined ? [] : [fact];
    });
