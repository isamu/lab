import type { Lexicon, Token } from "../plugin.ts";
import { citedTitles } from "./cited-title.ts";
import { columnOf, type Admit, type Column } from "./token-column.ts";

/**
 * 並びを読むための語彙表。participle は解析器が分詞と読まないが読点のあとで分詞の句を始める語（meaning）、
 * example は例を挙げる句（such as, e.g.）、pair は 2 つだけを結ぶ語とその接続詞（between and / either or）。
 */
export type ListWords = { readonly participle: ReadonlySet<string>; readonly example: Lexicon; readonly pair: ReadonlySet<string> };

const LIST_CONJUNCTION: ReadonlySet<string> = new Set(["and", "or"]);

export const isListConjunction = (token: Token | undefined): boolean => LIST_CONJUNCTION.has(token?.surface.toLowerCase() ?? "");

/** 並列はこれをまたがない。セミコロンの前後は別の節。 */
const CLAUSE_BREAK = new Set([";", ":", "—"]);

/** 各 token の前で閉じていない括弧の数。括弧の中の読点（external users (e.g., guests), and ...）は外の並列を切らない。 */
const PAREN_STEP: ReadonlyMap<string, number> = new Map([
  ["(", 1],
  [")", -1],
]);

export const depthsOf = (tokens: readonly Token[]): number[] => {
  let open = 0;
  return tokens.map((token) => {
    const before = open;
    open = Math.max(0, open + (PAREN_STEP.get(token.surface) ?? 0));
    return before;
  });
};

/** 冠詞や引用符を飛ばした、項目の頭の品詞。the parser と an exporter と samples を同じ形と見る。 */
export const NOMINAL = new Set(["NOUN", "PRON", "PROPN", "NUM", "ADJ"]);
export const VERBAL = new Set(["VERB", "AUX"]);
const NOUN_PHRASE_TAIL = new Set(["ADJ", "NOUN", "PROPN"]);
export const APPOSITIVE_ANCHOR = new Set(["NOUN", "PROPN"]);

export const isContent = (token: Token): boolean => token.pos !== "DET" && token.pos !== "PUNCT" && token.pos !== "X";

const isOpen = (token: Token): boolean => token.pos !== "PUNCT" && token.pos !== "X";

/** -ing 形（VerbForm=Ger）と過去分詞（Part）。filling the gaps と sentenced to prison は並べても並列にならない。 */
const VERB_FORMS = new Set(["Ger", "Part"]);

export const verbFormOf = (token: Token): string | undefined => {
  const form = token.features?.["VerbForm"];
  return form !== undefined && VERB_FORMS.has(form) ? form : undefined;
};

/** 同じ深さにある語の位置を、深さごとに左から。 */
const byDepth = (depths: readonly number[], test: (index: number) => boolean): ReadonlyMap<number, readonly number[]> =>
  depths.reduce((found, depth, index) => {
    if (!test(index)) return found;
    const list = found.get(depth);
    if (list === undefined) found.set(depth, [index]);
    else list.push(index);
    return found;
  }, new Map<number, number[]>());

const isComma = (token: Token): boolean => token.surface === ",";

/** 項目への問いの列。読点は項目に入ったり入らなかったりするので、脇に置いて問いごとに数える（token-column.ts）。 */
const columnsOf = (tokens: readonly Token[]) => {
  const of = (test: (token: Token) => boolean): Column => columnOf(tokens, test, isComma);
  return {
    content: of(isContent),
    open: of(isOpen),
    verbal: of((token) => VERBAL.has(token.pos)),
    adposition: of((token) => token.pos === "ADP"),
    determiner: of((token) => token.pos === "DET"),
    conjunction: of((token) => LIST_CONJUNCTION.has(token.surface.toLowerCase())),
    gerund: of((token) => verbFormOf(token) === "Ger"),
    participle: of((token) => verbFormOf(token) === "Part"),
    nounPhraseTail: of((token) => NOUN_PHRASE_TAIL.has(token.pos)),
    noun: of((token) => APPOSITIVE_ANCHOR.has(token.pos)),
    contentNotAdverb: of((token) => isContent(token) && token.pos !== "ADV"),
    notPunctuationOrAdverb: of((token) => token.pos !== "PUNCT" && token.pos !== "ADV"),
    notComma: columnOf(tokens, (token) => !isComma(token)),
    itemEnd: columnOf(tokens, (token) => isComma(token) || CLAUSE_BREAK.has(token.surface)),
    clauseBreak: columnOf(tokens, (token) => CLAUSE_BREAK.has(token.surface)),
  };
};

export type Columns = ReturnType<typeof columnsOf>;

/** 文を一度だけ読んで作る、項目の問いに答えるための表。 */
export type ListSentence = {
  readonly tokens: readonly Token[];
  readonly depths: readonly number[];
  readonly words: ListWords;
  readonly column: Columns;
  /** 各位置から始まる例の句の、最後の語の位置。語彙表の順に。 */
  readonly exampleEnds: readonly (readonly number[])[];
  /** 例の句の始まる位置。深さごとに。 */
  readonly exampleStarts: ReadonlyMap<number, readonly number[]>;
  /** 2 つだけを結ぶ語の位置。組む接続詞ごと、深さごとに。 */
  readonly pairOpeners: ReadonlyMap<string, ReadonlyMap<number, readonly number[]>>;
  /** 読点の位置。深さごとに。 */
  readonly commas: ReadonlyMap<number, readonly number[]>;
  readonly inCitedTitle: (at: number) => boolean;
};

/**
 * start から例の句の語を読んだときの、最後の語の位置。無ければ -1。項目は同じ深さの読点を持たないので、start と同じ深さの読点は
 * 飛ばす。続いた読点は同じ深さなので、まとめて飛ぶ。
 */
const phraseEnd = (tokens: readonly Token[], depths: readonly number[], notComma: Column, start: number, words: readonly Token[]): number =>
  words.reduce((at, word, offset) => {
    if (at === -1) return -1;
    const next = offset === 0 ? start : at + 1;
    const kept = tokens[next]?.surface === "," && depths[next] === depths[start] ? (notComma.next[next] ?? tokens.length) : next;
    return tokens[kept]?.surface === word.surface ? kept : -1;
  }, start);

const exampleEndsOf = (tokens: readonly Token[], depths: readonly number[], column: Columns, example: Lexicon): number[][] =>
  tokens.map((token, start) =>
    token.surface === ","
      ? []
      : example.flatMap(({ tokens: words = [] }) => {
          const end = words.length > 0 ? phraseEnd(tokens, depths, column.notComma, start, words) : -1;
          return end === -1 ? [] : [end];
        }),
  );

const pairOpenersOf = (tokens: readonly Token[], depths: readonly number[], pair: ReadonlySet<string>): Map<string, ReadonlyMap<number, readonly number[]>> =>
  new Map(
    [...LIST_CONJUNCTION].map((conjunction) => [
      conjunction,
      byDepth(depths, (index) => tokens[index]?.surface !== "," && pair.has(`${tokens[index]?.surface.toLowerCase() ?? ""} ${conjunction}`)),
    ]),
  );

/**
 * 1 つの and / or の深さから見た文。その深さの読点は項目の区切りで、項目の中には無い。ほかの深さの読点（括弧の中）は項目の語。
 */
export type ItemScope = { readonly sentence: ListSentence; readonly level: number; readonly admit: Admit };

export const scopeOf = (sentence: ListSentence, level: number): ItemScope => ({ sentence, level, admit: (index) => sentence.depths[index] !== level });

export const listSentenceOf = (tokens: readonly Token[], words: ListWords, source: string): ListSentence => {
  const depths = depthsOf(tokens);
  const column = columnsOf(tokens);
  const exampleEnds = exampleEndsOf(tokens, depths, column, words.example);
  return {
    tokens,
    depths,
    words,
    column,
    exampleEnds,
    exampleStarts: byDepth(depths, (index) => (exampleEnds[index]?.length ?? 0) > 0),
    pairOpeners: pairOpenersOf(tokens, depths, words.pair),
    commas: byDepth(depths, (index) => tokens[index]?.surface === ","),
    inCitedTitle: citedTitles(tokens, source),
  };
};
