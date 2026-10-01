import { escapeRegExp } from "./orthography.ts";
import type { BulletList, Span } from "./plugin.ts";
import { joined, linesAbove, type TextBlock } from "./text-above.ts";

/**
 * 箇条書きのすぐ前の文が予告した数（以下の3点、the following three steps）と、箇条書きのいちばん外側の項目の数。
 * 予告と読むのは、文の最後の一文に数がちょうど一つあり、先を指す語がその前にあるか文がコロンで終わるときだけ。
 * 言語の知識（先を指す語、漢数字や数の語、数える語、数を目安や順番にする語）は語彙表から受け取る。
 */
export type CountWords = {
  /** 以下の、次の、following。 */
  readonly anchors: readonly string[];
  /** 数を字で書いたもの。一から順に並べる。 */
  readonly numbers: readonly string[];
  /** 数のすぐ後ろで並べるものを数える語。点、つ、steps。 */
  readonly counters: readonly string[];
  /** 数のすぐ前にあると予告でなくなる語（約、第、at least）。 */
  readonly hedgesBefore: readonly string[];
  /** 数か数える語のすぐ後ろにあると予告でなくなる語（以上、目、or more）。 */
  readonly hedgesAfter: readonly string[];
};

export type CountMismatch = { readonly offset: number; readonly phrase: string; readonly announced: number; readonly listed: number };

/** counted: 数える語が付いている（3点）。付いていない数（the following two:）は、先を指す語のすぐ後ろでだけ予告に読む。 */
type Phrase = { readonly start: number; readonly numberEnd: number; readonly end: number; readonly announced: number; readonly counted: boolean };

/** 予告の文の外側。見出し、表、引用、コードの囲みの行は、すぐ下の箇条書きを予告する文ではない。 */
const NOT_A_LEAD = /^[ \t]*(?:#|\||>|```|~~~)/u;

/** 箇条書きのすぐ前の塊。見出し・表・引用・コードの囲みなら undefined。 */
const leadBefore = (source: string, listStart: number): TextBlock | undefined => {
  const lines = linesAbove(source, listStart);
  return lines.some((line) => NOT_A_LEAD.test(line.text)) ? undefined : joined(source, lines);
};

/** 文の終わり。英語の「.」は後ろが空白のときだけ（3.5 や e.g. の途中で切らない）。 */
const SENTENCE_END = /[。！？!?]|\.(?=\s)/gu;

/** 塊の最後の一文の始まり（塊の中の位置）。 */
const lastSentenceStart = (text: string): number => {
  const body = text.trimEnd();
  const ends = [...body.matchAll(SENTENCE_END)].map((match) => match.index + match[0].length).filter((end) => end < body.length);
  return ends.at(-1) ?? 0;
};

const alternation = (words: readonly string[]): string =>
  words
    .toSorted((a, b) => b.length - a.length)
    .map(escapeRegExp)
    .join("|");

/**
 * 数と、それが数えるもの。数の前が数字・英字・数の字なら数の途中（十三、23、eleven の中）。
 * 英語は数と数える語の間に語を二つまで置ける（three key steps）。数える語が無くても、文がコロンで終わる直前の数（the following two:）は数に読む。
 */
const phrasePattern = (words: CountWords): RegExp => {
  const numberChars = escapeRegExp([...new Set(words.numbers.join(""))].join(""));
  const numbers = words.numbers.length === 0 ? "\\p{Nd}+" : `\\p{Nd}+|${alternation(words.numbers)}`;
  const counted = `[ \\t\\u00a0]?(?:\\p{Ll}[\\p{Ll}-]*[ \\t]){0,2}(${alternation(words.counters)})(?![A-Za-z])`;
  return new RegExp(`(?<![\\p{N}A-Za-z${numberChars}])(${numbers})(?:${counted}|(?=[ \\t]?[:：][ \\t]*$))`, "giu");
};

const valueOf = (written: string, numbers: readonly string[]): number => {
  const digits = Number(written.normalize("NFKC"));
  if (!Number.isNaN(digits)) return digits;
  return numbers.findIndex((number) => number.toLowerCase() === written.toLowerCase()) + 1;
};

const LATIN_LETTER = /[A-Za-z]/u;
const isLatin = (char: string | undefined): boolean => LATIN_LETTER.test(char ?? "");

/** 英語の語は語の切れ目で照らす（over が moreover に当たらない）。日本語の語は字面どおり。 */
const endsWithWord = (text: string, word: string): boolean => text.endsWith(word) && !(isLatin(word[0]) && isLatin(text.at(-word.length - 1)));

const startsWithWord = (text: string, word: string): boolean => text.startsWith(word) && !(isLatin(word.at(-1)) && isLatin(text[word.length]));

const isHedged = (sentence: string, phrase: Phrase, words: CountWords): boolean => {
  const before = sentence.slice(0, phrase.start).trimEnd().toLowerCase();
  const afters = [sentence.slice(phrase.numberEnd), sentence.slice(phrase.end)].map((text) => text.trimStart().toLowerCase());
  return (
    words.hedgesBefore.some((hedge) => endsWithWord(before, hedge.toLowerCase())) ||
    words.hedgesAfter.some((hedge) => afters.some((after) => startsWithWord(after, hedge.toLowerCase())))
  );
};

const COLON_END = /[:：][ \t]*$/u;

/** 数字か、語の切れ目で区切った英語の数の語（two）。漢数字は「一緒」「一般」の中にもあるので数えない。 */
const numberPattern = (words: CountWords): RegExp => {
  const latin = words.numbers.filter((number) => isLatin(number[0]));
  return latin.length === 0 ? /\p{Nd}/u : new RegExp(`\\p{Nd}|(?<![A-Za-z])(?:${alternation(latin)})(?![A-Za-z])`, "iu");
};

type Patterns = { readonly phrase: RegExp; readonly number: RegExp };

/**
 * 数える語の無い数は、先を指す語のすぐ後ろでだけ（the following two:）。「under $75:」の金額を数に読まない。
 * 先を指す語が無く、終わりのコロンだけが予告なら、コロンが渡すのはその手前のいちばん近い数。数の後ろにまだ数があれば
 * （「1 つのページにまとめていましたが、2 ページに分けました:」）、その数は予告の数ではない。
 */
const pointsAhead = (sentence: string, phrase: Phrase, anchors: readonly string[], number: RegExp): boolean => {
  const before = sentence.slice(0, phrase.start).toLowerCase();
  const lowered = anchors.map((anchor) => anchor.toLowerCase());
  if (!phrase.counted) return lowered.some((anchor) => endsWithWord(before.trimEnd(), anchor));
  if (lowered.some((anchor) => before.includes(anchor))) return true;
  return COLON_END.test(sentence.trimEnd()) && !number.test(sentence.slice(phrase.end));
};

/** 最後の一文の予告。数がちょうど一つで、目安や順番でなく、先を指しているときだけ。 */
const announcedIn = (sentence: string, words: CountWords, patterns: Patterns): Phrase | undefined => {
  const phrases = [...sentence.matchAll(patterns.phrase)].map((match) => ({
    start: match.index,
    numberEnd: match.index + (match[1] ?? "").length,
    end: match.index + match[0].length,
    announced: valueOf(match[1] ?? "", words.numbers),
    counted: match[2] !== undefined,
  }));
  const only = phrases.length === 1 ? phrases[0] : undefined;
  if (only === undefined || only.announced < 1 || isHedged(sentence, only, words)) return undefined;
  return pointsAhead(sentence, only, words.anchors, patterns.number) ? only : undefined;
};

/** 位置から空白と改行を読み飛ばした先。 */
const pastSpace = (source: string, at: number): number => {
  const filled = /[^ \t\r\n]/gu;
  filled.lastIndex = at;
  return filled.exec(source)?.index ?? source.length;
};

/** 箇条書きの終わり（後ろの空白を読み飛ばした先）と始まり。空白だけを挟んで続く二つの箇条書きは、終わりと始まりが同じ位置になる。 */
type Neighbours = { readonly ends: ReadonlySet<number>; readonly starts: ReadonlySet<number> };

const neighboursOf = (source: string, lists: readonly BulletList[]): Neighbours => ({
  ends: new Set(lists.map((list) => pastSpace(source, list.span.end))),
  starts: new Set(lists.map((list) => list.span.start)),
});

/** 空白だけを挟んで前か後ろに別の箇条書きが続く。印が変わって二つに割れた一つの並びかもしれず、数を決められない。 */
const hasNeighbour = (source: string, list: Span, neighbours: Neighbours): boolean =>
  neighbours.ends.has(list.start) || neighbours.starts.has(pastSpace(source, list.end));

/**
 * 分類した箇条書き（「- **実運用**: CLI / Telegram」）の行は、ラベルの後ろに項目を区切って並べる。予告の数は区切った項目の数かもしれない。
 * 区切りは「/」「／」「、」「,」「，」。
 */
const CATEGORY_ITEM = /^[ \t]*(?:[-*+]|\d{1,9}[.)])[ \t]+[^:：\n]{1,40}[:：][ \t]*(?<members>\S[^\n]*)/u;
const MEMBER_SEPARATOR = /[/／、,，]/u;

const membersOf = (item: string): number | undefined =>
  CATEGORY_ITEM.exec(item)
    ?.groups?.["members"]?.split(MEMBER_SEPARATOR)
    .filter((member) => member.trim() !== "").length;

/** どの行も分類の形なら、区切って並べた項目の数の和。一行でも違えば undefined。 */
const categorisedCount = (source: string, list: BulletList): number | undefined => {
  const counts = list.itemSpans.map((item) => membersOf(source.slice(item.start, item.end)));
  return counts.every((count) => count !== undefined) ? counts.reduce<number>((sum, count) => sum + (count ?? 0), 0) : undefined;
};

/** 予告の数が、行の数か、分類した行に並べた項目の数に合う。 */
const matchesList = (announced: number, source: string, list: BulletList): boolean =>
  announced === list.items.length || announced === categorisedCount(source, list);

type Context = { readonly source: string; readonly words: CountWords; readonly patterns: Patterns; readonly neighbours: Neighbours };

const mismatchOf = ({ source, words, patterns, neighbours }: Context, list: BulletList): CountMismatch[] => {
  if (hasNeighbour(source, list.span, neighbours)) return [];
  const lead = leadBefore(source, list.span.start);
  if (lead === undefined) return [];
  const sentenceStart = lastSentenceStart(lead.text);
  const sentence = lead.text.slice(sentenceStart);
  const phrase = announcedIn(sentence, words, patterns);
  if (phrase === undefined || matchesList(phrase.announced, source, list)) return [];
  const offset = lead.start + sentenceStart + phrase.start;
  return [{ offset, phrase: sentence.slice(phrase.start, phrase.end).trim(), announced: phrase.announced, listed: list.items.length }];
};

export const announcedCountMismatches = (source: string, lists: readonly BulletList[], words: CountWords): CountMismatch[] => {
  if (words.counters.length === 0) return [];
  const context = { source, words, patterns: { phrase: phrasePattern(words), number: numberPattern(words) }, neighbours: neighboursOf(source, lists) };
  return lists.flatMap((list) => mismatchOf(context, list));
};
