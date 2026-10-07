import type { Span, Token } from "../plugin.ts";
import { escapeRegExp } from "../orthography.ts";
import { comparable, sameValue, type FactValue } from "./fact-values.ts";

/**
 * 要約の「XからYに」（"from X to Y"）を、本文が二つの条件（前と後、無いときとあるとき、2025年と2026年）で書いた同じ項目の二つの値と
 * 組にして比べる。項目の名前が本文の文にあり、二つの値の条件がどちらも読めたときだけ比べる。言語の知識（から、to、前、after）は
 * 語彙表から取る。
 */
export type WordAt = { readonly pattern: string; readonly position: "before" | "after" };
export type ConditionWord = { readonly pattern: string; readonly group: string };

export type ChangeWords = {
  /** もとの値に付く語（from、から）。 */
  readonly from: readonly WordAt[];
  /** 動いた先の値に付く語（to、に）。 */
  readonly to: readonly WordAt[];
  /** 名前と変化のあいだにあれば、変化ではなく幅を言う語（"ranges from 0 to 10"）。 */
  readonly notChange: readonly string[];
  /** 名前と値のあいだで飛ばす語（は、が）。 */
  readonly subjectMarks: readonly string[];
  /** 名前の語をつなぐ語（の、of）。position が after の語（の）は、前の語が後ろの語を修飾する。短い名前はその前の語を書かないことがある（「無いときの誤りの率」の「誤りの率」）。 */
  readonly joiners: readonly WordAt[];
  /** もとの側の条件（before、無いとき）と、動いた先の側の条件（after、あるとき）。同じ group の語どうしが組になる。 */
  readonly conditionsFrom: readonly ConditionWord[];
  readonly conditionsTo: readonly ConditionWord[];
};

export type ChangeSentence = { readonly span: Span; readonly text: string; readonly tokens: readonly Token[]; readonly summary: boolean };

/** 名前（subject）の付いた、もとの値と先の値の組。names は同じ項目を指す名前の書き方（修飾を落とした短い名前も）。 */
export type ValuePair = {
  readonly subject: string;
  readonly key: string;
  readonly names: readonly string[];
  readonly from: FactValue;
  readonly to: FactValue;
};

export type PairConflict = { readonly summary: ValuePair; readonly body: ValuePair };

const LATIN = /^[A-Za-z]/u;
const SPACES = /\s+/gu;
/** 暦の年（2025、2026年）。条件として読み、値としては読まない。日付の一部（2011-10-26、2025年10月）は年の条件ではない。 */
const YEAR = /(?<![\d.,/-])(?:1[89]|2[01])\d{2}(?![\d.,%/-]|年\d)/gu;

const squeezed = (text: string): string => text.replace(SPACES, "").toLowerCase();

/** 語の現れる所。英字の語は語の切れ目で、ほかは書いたとおりに探す。 */
const wordSpans = (text: string, word: string, offset: number): Span[] => {
  const pattern = LATIN.test(word) ? new RegExp(`\\b${escapeRegExp(word)}\\b`, "giu") : new RegExp(escapeRegExp(word), "gu");
  return [...text.matchAll(pattern)].map((match) => ({ start: offset + match.index, end: offset + match.index + match[0].length }));
};

const endsWithWord = (text: string, word: string): boolean => {
  const lowered = text.trimEnd().toLowerCase();
  if (!lowered.endsWith(word.toLowerCase())) return false;
  return !LATIN.test(word) || !/[A-Za-z]$/u.test(lowered.slice(0, lowered.length - word.length));
};

const startsWithWord = (text: string, word: string): boolean => {
  const lowered = text.trimStart().toLowerCase();
  if (!lowered.startsWith(word.toLowerCase())) return false;
  return !LATIN.test(word) || !/^[A-Za-z]/u.test(lowered.slice(word.length));
};

const patternsAt = (words: readonly WordAt[], position: WordAt["position"]): string[] =>
  words.filter((word) => word.position === position).map((word) => word.pattern);

/** 二つの値のあいだが、もとの値の後ろの語と先の値の前の語だけか（" to "、「から」）。 */
const joinsChange = (between: string, words: ChangeWords): boolean => {
  const fromAfter = ["", ...patternsAt(words.from, "after")];
  const toBefore = ["", ...patternsAt(words.to, "before")];
  const shown = squeezed(between);
  return shown !== "" && fromAfter.some((first) => toBefore.some((second) => squeezed(first + second) === shown));
};

/** 前に要る語（from）があれば、その語の始まり。要らなければ値の始まり。無ければ undefined。 */
const changeStart = (source: string, value: FactValue, words: ChangeWords): number | undefined => {
  const before = patternsAt(words.from, "before");
  if (before.length === 0) return value.start;
  const head = source.slice(0, value.start);
  const found = before.find((word) => endsWithWord(head, word));
  return found === undefined ? undefined : head.trimEnd().length - found.length;
};

const TAIL_LENGTH = 40;

const endsChange = (source: string, value: FactValue, words: ChangeWords): boolean => {
  const after = patternsAt(words.to, "after");
  const tail = source.slice(value.end, value.end + TAIL_LENGTH);
  return after.length === 0 || after.some((word) => startsWithWord(tail, word));
};

const isYear = (source: string, value: FactValue): boolean => value.unit === "" && /^(?:1[89]|2[01])\d{2}$/u.test(source.slice(value.start, value.end));

const isQuantityPair = (source: string, from: FactValue, to: FactValue): boolean =>
  from.kind === "quantity" && comparable(from, to) && !isYear(source, from) && !isYear(source, to);

const isBlank = (token: Token): boolean => token.surface.trim() === "";
const SKIPPED: ReadonlySet<string> = new Set(["VERB", "AUX", "ADV"]);
const NAME_WORD: ReadonlySet<string> = new Set(["NOUN", "PROPN", "ADJ"]);
const HEAD_WORD: ReadonlySet<string> = new Set(["NOUN", "PROPN"]);
const DIGIT = /\d/u;

const isSkipped = (token: Token, marks: ReadonlySet<string>): boolean => isBlank(token) || marks.has(token.surface) || SKIPPED.has(token.pos);

const joinerSet = (words: ChangeWords): ReadonlySet<string> => new Set(words.joiners.map((word) => word.pattern.toLowerCase()));

const isNameToken = (token: Token, joiners: ReadonlySet<string>): boolean =>
  (NAME_WORD.has(token.pos) && !DIGIT.test(token.surface)) || joiners.has(token.surface.toLowerCase());

const keyOf = (text: string): string => text.normalize("NFKC").toLowerCase().replace(SPACES, " ");

/** 名前の並びを、つなぐ語で始まらず名詞で終わるところまで切る。 */
const trimmedName = (run: readonly Token[], joiners: ReadonlySet<string>): Token[] => {
  const named = run.slice(
    Math.max(
      0,
      run.findIndex((token) => !joiners.has(token.surface.toLowerCase())),
    ),
  );
  return named.slice(0, named.findLastIndex((token) => HEAD_WORD.has(token.pos)) + 1);
};

/** 一つの名前の書き方: 全体と、修飾の語（「無いときの」）を前から落としたもの。 */
const namesOf = (source: string, named: readonly Token[], words: ChangeWords): string[] => {
  const last = named.at(-1);
  if (last === undefined) return [];
  const dropping = new Set(words.joiners.filter((word) => word.position === "after").map((word) => word.pattern.toLowerCase()));
  const starts = [0, ...named.flatMap((token, index) => (dropping.has(token.surface.toLowerCase()) ? [index + 1] : []))];
  return starts.flatMap((start) => {
    const first = named[start];
    return first === undefined ? [] : [keyOf(source.slice(first.span.start, last.span.end))];
  });
};

/** 文の中の名前の並び（名詞と、つなぐ語でつながる語）ごとの、名前の書き方。 */
const namesIn = (source: string, sentence: ChangeSentence, words: ChangeWords): Set<string> => {
  const joiners = joinerSet(words);
  const runs = sentence.tokens.reduce<Token[][]>((found, token, index) => {
    if (!isNameToken(token, joiners)) return found;
    const previous = sentence.tokens[index - 1];
    const current = previous !== undefined && isNameToken(previous, joiners) ? found.at(-1) : undefined;
    if (current === undefined) found.push([token]);
    else current.push(token);
    return found;
  }, []);
  return new Set(runs.flatMap((run) => namesOf(source, trimmedName(run, joiners), words)));
};

/**
 * 変化の前の名前の語の並び（"error rate"、「誤りの率」）。その前の空白、は・が、動詞（"the rate fell from"）は飛ばす。
 * つなぐ語で始まらず、名詞で終わる。
 */
const nameTokens = (tokens: readonly Token[], words: ChangeWords): Token[] => {
  const marks = new Set(words.subjectMarks);
  const joiners = joinerSet(words);
  const head = tokens.slice(0, tokens.findLastIndex((token) => !isSkipped(token, marks)) + 1);
  const run = head.slice(head.findLastIndex((token) => !isNameToken(token, joiners)) + 1);
  const named = trimmedName(run, joiners);
  return HEAD_WORD.has(run.at(-1)?.pos ?? "") ? named : [];
};

type Subject = { readonly subject: string; readonly key: string; readonly names: readonly string[] };

const subjectBefore = (source: string, sentence: ChangeSentence, offset: number, words: ChangeWords): Subject | undefined => {
  const named = nameTokens(
    sentence.tokens.filter((token) => token.span.end <= offset),
    words,
  );
  const [first, last] = [named[0], named.at(-1)];
  if (first === undefined || last === undefined) return undefined;
  const subject = source.slice(first.span.start, last.span.end);
  const gap = source.slice(last.span.end, offset);
  if (words.notChange.some((word) => wordSpans(gap, word, 0).length > 0)) return undefined;
  return { subject, key: keyOf(subject), names: namesOf(source, named, words) };
};

/** 文の中の「XからYに」と、その前の名前。 */
const changesIn = (source: string, sentence: ChangeSentence, values: readonly FactValue[], words: ChangeWords): ValuePair[] =>
  values.slice(0, -1).flatMap((from, index): ValuePair[] => {
    const to = values[index + 1];
    if (to === undefined || !isQuantityPair(source, from, to) || !joinsChange(source.slice(from.end, to.start), words)) return [];
    const start = changeStart(source, from, words);
    if (start === undefined || !endsChange(source, to, words)) return [];
    const named = subjectBefore(source, sentence, start, words);
    return named === undefined ? [] : [{ ...named, from, to }];
  });

type Mark = Span & { readonly side: "from" | "to"; readonly group: string; readonly year?: number };

const conditionMarks = (sentence: ChangeSentence, words: readonly ConditionWord[], side: Mark["side"]): Mark[] =>
  words.flatMap((word) => wordSpans(sentence.text, word.pattern, sentence.span.start).map((span): Mark => ({ ...span, side, group: word.group })));

const yearMarks = (sentence: ChangeSentence): Mark[] =>
  [...sentence.text.matchAll(YEAR)].map((match) => {
    const start = sentence.span.start + match.index;
    return { start, end: start + match[0].length, side: "from", group: "year", year: Number(match[0]) };
  });

const overlaps = (left: Span, right: Span): boolean => left.start < right.end && right.start < left.end;

/** 年の組は、早い年がもとの側。違う年がちょうど二つのときだけ。 */
const yearPair = (marks: readonly Mark[]): Mark[] | undefined => {
  const years = marks.filter((mark) => mark.group === "year");
  const [first, second] = years;
  if (years.length !== 2 || first === undefined || second === undefined || first.year === second.year) return undefined;
  const later = (first.year ?? 0) < (second.year ?? 0) ? second : first;
  return years.map((mark) => (mark === later ? { ...mark, side: "to" } : mark));
};

/** 一つの組の語が、もとの側と先の側に一つずつ。そういう組がちょうど一つのときだけ、その二つ。 */
const conditionPair = (marks: readonly Mark[]): Mark[] | undefined => {
  const groups = [...new Set(marks.map((mark) => mark.group))];
  const pairs = groups.flatMap((group) => {
    if (group === "year") return [yearPair(marks)].filter((pair) => pair !== undefined);
    const inGroup = marks.filter((mark) => mark.group === group);
    const sides = new Set(inGroup.map((mark) => mark.side));
    return inGroup.length === 2 && sides.size === 2 ? [inGroup] : [];
  });
  return pairs.length === 1 ? pairs[0] : undefined;
};

const CLAUSE_BREAK = /[,;、，；]/u;

/** 二つの範囲のあいだに、句の切れ目（, ; 、）がある。 */
const brokenBetween = (sentence: ChangeSentence, left: Span, right: Span): boolean =>
  CLAUSE_BREAK.test(sentence.text.slice(left.end - sentence.span.start, right.start - sentence.span.start));

/**
 * 条件と値が、条件・値・条件・値か、値・条件・値・条件の順に並び、二組のあいだが句の切れ目で分かれるときだけ、どの値がどの条件の
 * ものか決まる。切れ目が無いと（"With breaks, against 2.4% without them, … 1.6%"）、条件が前と後ろのどちらの値に付くか決まらない。
 */
const pairByOrder = (sentence: ChangeSentence, conditions: readonly Mark[], values: readonly FactValue[]): { from: FactValue; to: FactValue } | undefined => {
  const [c1, c2] = conditions.toSorted((left, right) => left.start - right.start);
  const [v1, v2] = values;
  if (c1 === undefined || c2 === undefined || v1 === undefined || v2 === undefined) return undefined;
  const leads = c1.end <= v1.start && v1.end <= c2.start && c2.end <= v2.start && brokenBetween(sentence, v1, c2);
  const follows = v1.end <= c1.start && c1.end <= v2.start && v2.end <= c2.start && brokenBetween(sentence, c1, v2);
  if (!leads && !follows) return undefined;
  return c1.side === "from" ? { from: v1, to: v2 } : { from: v2, to: v1 };
};

/** 本文の一文が、名前と、比べられる二つの値と、その二つの条件を書いていれば、その組。 */
const conditionedPair = (sentence: ChangeSentence, values: readonly FactValue[], summary: ValuePair, words: ChangeWords): ValuePair | undefined => {
  const marks = [...conditionMarks(sentence, words.conditionsFrom, "from"), ...conditionMarks(sentence, words.conditionsTo, "to"), ...yearMarks(sentence)];
  const free = marks.filter((mark) => mark.group === "year" || !values.some((value) => overlaps(mark, value)));
  const measured = values.filter((value) => comparable(summary.from, value) && !free.some((mark) => overlaps(mark, value)));
  const conditions = conditionPair(free);
  if (measured.length !== 2 || conditions === undefined) return undefined;
  const pair = pairByOrder(sentence, conditions, measured);
  return pair === undefined ? undefined : { ...summary, ...pair };
};

const within = (span: Span, values: readonly FactValue[]): FactValue[] => values.filter((value) => value.start >= span.start && value.end <= span.end);

const samePair = (left: ValuePair, right: ValuePair): boolean => sameValue(left.from, right.from) && sameValue(left.to, right.to);

/** 本文の組。本文に書いた「XからYに」と、条件で分けて書いた二つの値。 */
const bodyPairs = (source: string, sentences: readonly ChangeSentence[], values: readonly FactValue[], summary: ValuePair, words: ChangeWords): ValuePair[] =>
  sentences
    .filter((sentence) => !sentence.summary)
    .flatMap((sentence) => {
      const inside = within(sentence.span, values);
      const changes = changesIn(source, sentence, inside, words).filter((change) => change.names.includes(summary.key));
      const conditioned = namesIn(source, sentence, words).has(summary.key) ? conditionedPair(sentence, inside, summary, words) : undefined;
      return [...changes, ...(conditioned === undefined ? [] : [conditioned])];
    })
    .filter((pair) => comparable(summary.from, pair.from) && comparable(summary.to, pair.to));

/** 要約の「XからYに」が、本文で一通りに書いた同じ名前の組と違う。本文の組が無いか二通り以上なら言わない。 */
export const conditionPairConflicts = (
  source: string,
  sentences: readonly ChangeSentence[],
  values: readonly FactValue[],
  words: ChangeWords,
): PairConflict[] =>
  sentences
    .filter((sentence) => sentence.summary)
    .flatMap((sentence) => changesIn(source, sentence, within(sentence.span, values), words))
    .flatMap((summary) => {
      const distinct = bodyPairs(source, sentences, values, summary, words).reduce<ValuePair[]>(
        (kept, pair) => (kept.some((seen) => samePair(seen, pair)) ? kept : [...kept, pair]),
        [],
      );
      const [only] = distinct;
      return distinct.length !== 1 || only === undefined || samePair(summary, only) ? [] : [{ summary, body: only }];
    });
