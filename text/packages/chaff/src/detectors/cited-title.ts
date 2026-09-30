import type { Token } from "../plugin.ts";
import { MINOR_WORDS } from "./heading-case.ts";

// 引用した題名（誌名・論文名・書名）。題名の中の読点は題名を付けた人のもので、書き手が並べかたを選んだものではない。

const isCapitalised = (token: Token): boolean => /^\p{Lu}/u.test(token.surface);

/** 題名の中でつなぐ記号。ハイフン（Low-Inflation）と、副題の前のコロン（Maximum Employment: A Shortfalls Approach）。 */
const TITLE_JOINERS: ReadonlySet<string> = new Set(["-", ":"]);

/** 題名の中の語。大文字で始まる語と、Title Case でも小文字のままの語（of, and, a）と、つなぐ記号。 */
const isTitleWord = (token: Token): boolean => isCapitalised(token) || MINOR_WORDS.has(token.surface) || TITLE_JOINERS.has(token.surface);

/** 題名の中の区切り。左は読点もまたぐ（Journal of Money, Credit）。 */
const inLeftRun = (token: Token): boolean => isTitleWord(token) || token.surface === ",";

/** 2 つの語の間が空白だけか。覆った強調の印（*Journal）や記号を挟めば、題名の語の続きはそこで切れる。 */
const adjoins = (source: string, left: Token | undefined, right: Token | undefined): boolean =>
  left === undefined || right === undefined || source.slice(left.span.end, right.span.start).trim() === "";

/**
 * and / or の左の、題名の語の続きの頭。最初の大文字の語から。小文字の語から始めると、引用符の中の並び（‘the UK, France and
 * Spain’）や、論文名のあとの編者の並び（," in Heather Boushey, Ryan Nunn, and Jay Shambaugh, eds.）まで題名と読む。
 */
const leftStart = (tokens: readonly Token[], at: number, source: string): number | undefined => {
  const stop = tokens.slice(0, at).findLastIndex((token, index) => !inLeftRun(token) || !adjoins(source, token, tokens[index + 1]));
  const start = tokens.findIndex((token, index) => index > stop && index < at && isCapitalised(token));
  return start === -1 ? undefined : start;
};

/** and / or の右の、題名の語の続きの最後の大文字の語。 */
const rightEnd = (tokens: readonly Token[], at: number, source: string): number | undefined => {
  const stop = tokens.findIndex((token, index) => index > at && (!isTitleWord(token) || !adjoins(source, tokens[index - 1], token)));
  const last = tokens.slice(at + 1, stop === -1 ? undefined : stop).findLastIndex(isCapitalised);
  return last === -1 ? undefined : at + 1 + last;
};

/** 印を探す幅。いちばん長い印（***）と、読点・引用符・空白が収まる。 */
const MARK_REACH = 8;

/** 題名の最初の語にくっついた開きの印（“ ‘ " ' * _）。 */
const OPENING = /(?:["'“‘]|\*{1,3}|_{1,3})$/u;
/** 題名の直後の閉じの印。句読点を挟んでよい（Employment,”）。印の後ろが語なら、語の中の字（TO_CHAR、Madrid’s）。 */
const CLOSING = /^[,.;:!?]?(?:["'”’]|\*{1,3}|_{1,3})(?![\p{L}\p{N}])/u;
/** 引用した論文名のあとの読点と閉じる引用符。そのあとの題名は誌名（"Three Lessons," Journal of Money, Credit and Banking）。 */
const AFTER_QUOTED_TITLE = /,\s*["'”’]\s*$/u;
/** 誌名のあとは、巻号や頁へ続く読点か文の終わり。述語が続けば（“Done,” Smith, Jones and Brown argued）主語の並び。 */
const VENUE_END = /^\s*(?:[,;.]|$)/u;

const LIST_CONJUNCTIONS: ReadonlySet<string> = new Set(["and", "or"]);

const isPhraseWord = (token: Token): boolean => (isCapitalised(token) || MINOR_WORDS.has(token.surface)) && !LIST_CONJUNCTIONS.has(token.surface);

/**
 * 語の続きに、2 語以上の句があるか（Journal of Money、Their Nature、The Update）。1 語ずつの名前の並び
 * （‘Paris, Rome and Madrid’）は、引用符の中でも書き手が並べたもの。
 */
const holdsPhrase = (run: readonly Token[]): boolean => run.some((token, index) => index > 0 && isPhraseWord(token) && isPhraseWord(run[index - 1] ?? token));

/**
 * at の and / or が、引用した題名の中にあるか。and / or の両隣が Title Case の語の続きで、2 語以上の句を含み、その続きが
 * 引用符か強調の印で囲まれているか、引用符で閉じた論文名のすぐ後ろにあって読点か文の終わりが続く（誌名）とき。
 * 本文の固有名詞の並び（Login.gov, TTS Engineering and USAi）や著者の並びは囲まれていないので、題名と読まない。
 */
export const inCitedTitle = (tokens: readonly Token[], at: number, source: string): boolean => {
  const start = leftStart(tokens, at, source);
  const end = rightEnd(tokens, at, source);
  const first = start === undefined ? undefined : tokens[start];
  const last = end === undefined ? undefined : tokens[end];
  if (start === undefined || end === undefined || first === undefined || last === undefined) return false;
  if (!holdsPhrase(tokens.slice(start, end + 1))) return false;
  const before = source.slice(Math.max(0, first.span.start - MARK_REACH), first.span.start);
  const after = source.slice(last.span.end, last.span.end + MARK_REACH);
  return (OPENING.test(before) && CLOSING.test(after)) || (AFTER_QUOTED_TITLE.test(before) && VENUE_END.test(after));
};
