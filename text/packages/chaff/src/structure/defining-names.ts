import { escapeRegExp } from "../orthography.ts";

// 定義の括弧の前に書いた名前と、それを定義より前で写した所。純関数: 文（本文の一続き）と、その中の位置だけを見る。

/** 一つの文。start は文書の中の位置。 */
type Sentence = { readonly start: number; readonly text: string };

const OPENING_BRACKET = /[\s（(]/u;

/** 定義の括弧を開けた字（（、空白）を後ろから外した、括弧の前の名前。 */
export const nameBefore = (text: string): string => {
  let end = text.length;
  while (end > 0 && OPENING_BRACKET.test(text.charAt(end - 1))) end -= 1;
  return text.slice(0, end);
};

/** 二つの文字列が後ろから何字重なるか。 */
export const sharedTail = (left: string, right: string): number => {
  let shared = 0;
  while (shared < left.length && shared < right.length && left.at(-1 - shared) === right.at(-1 - shared)) shared += 1;
  return shared;
};

/** 漢字・仮名の名前の頭を決める字。名前はこの字の後ろから括弧の前まで（、株式会社ジェイアール東日本企画（以下「会社」））。 */
const NAME_BOUNDARY = /[\s、。，．,.;；:：（）()「」『』【】［］[\]]/u;
const LATIN_NAME_END = /[\p{Script=Latin}\p{N}.]$/u;
const CAPITALISED = /^[\p{Lu}\p{N}&]/u;
/** 大文字の語のあいだにだけ入る、短い小文字の語（Board of Directors の of）。 */
const CONNECTOR = /^\p{Ll}{1,3}$/u;
const TOKEN = /\S+/gu;

/** 英語の名前: 括弧の前から遡った、大文字で始まる語の並び（Youth Sports Management, LLC、Board of Directors）。 */
const latinNameIn = (text: string): string => {
  const tokens = [...text.matchAll(TOKEN)];
  const kept = (index: number): boolean => {
    const word = tokens[index]?.[0] ?? "";
    const previous = tokens[index - 1]?.[0] ?? "";
    return CAPITALISED.test(word) || (CONNECTOR.test(word) && CAPITALISED.test(previous) && !previous.endsWith(","));
  };
  const stop = tokens.findLastIndex((_, index) => !kept(index));
  const first = tokens[stop + 1];
  return first === undefined ? "" : text.slice(first.index);
};

/** 括弧の前の長い名前。英字で終われば大文字の語の並び、そうでなければ句読点・括弧の後ろから。 */
export const longNameIn = (text: string): string => {
  if (LATIN_NAME_END.test(text)) return latinNameIn(text);
  const chars = [...text];
  return chars.slice(chars.findLastIndex((char) => NAME_BOUNDARY.test(char)) + 1).join("");
};

/** 定義の括弧の前の名前（name）、その前の文（before）、括弧の中の語より前（head: (this “Agreement”) の (this 。引用符は空白にする）。 */
export type DefiningName = { readonly name: string; readonly before: string; readonly head: string };

const LETTER_OR_SPACE = /[\p{L}\p{N}\s]/u;

/** 終わりの引用符と強調の印（“、「、***）を空白にしたもの。 */
const withoutOpeningQuote = (text: string): string => {
  const chars = [...text];
  return `${chars.slice(0, chars.findLastIndex((char) => LETTER_OR_SPACE.test(char)) + 1).join("")} `;
};
const ROUND_OPEN = new Set(["（", "("]);
const ROUND_CLOSE = new Set(["）", ")"]);

/** text の終わりで開いたままの丸括弧の位置（…法律（令和6年法律第69号。以下「…」の（）。無ければ undefined。 */
const openBracketAt = (text: string): number | undefined => {
  const open: number[] = [];
  text.split("").forEach((char, index) => {
    if (ROUND_OPEN.has(char)) open.push(index);
    else if (ROUND_CLOSE.has(char)) open.pop();
  });
  return open.at(-1);
};

/** 文の中の定義の範囲 [spanStart, spanEnd) から、定義の前の名前を取る。定義が括弧の中の注記の後ろにあれば、その括弧の前の名前。位置は文書の中の位置。 */
export const definingNameOf = (sentence: Sentence, spanStart: number, spanEnd: number, term: string): DefiningName => {
  const beforeSpan = sentence.text.slice(0, spanStart - sentence.start);
  const prefix = nameBefore(beforeSpan.slice(0, openBracketAt(beforeSpan) ?? beforeSpan.length));
  const name = longNameIn(prefix);
  const span = sentence.text.slice(spanStart - sentence.start, spanEnd - sentence.start);
  const termAt = span.indexOf(term);
  return { name, before: prefix.slice(0, prefix.length - name.length), head: termAt === -1 ? "" : withoutOpeningQuote(span.slice(0, termAt)) };
};

/** 長い名前の写しと読むのに、語のほかに名前と重ならなければならない字の数（手引き の前の「の」と「成」）。 */
export const MIN_ECHO = 2;
const LATIN_WORD_CHAR = /[\p{Script=Latin}\p{N}]/u;

/** 名前の from の位置が英語の語の途中なら、次の語の頭へ進める。limit を越えれば undefined。 */
const wordStartFrom = (name: string, from: number, limit: number): number | undefined => {
  if (from === 0 || !LATIN_WORD_CHAR.test(name.charAt(from - 1)) || !LATIN_WORD_CHAR.test(name.charAt(from))) return from;
  const space = name.slice(from).search(/\s/u);
  return space === -1 || from + space + 1 > limit ? undefined : from + space + 1;
};

const indexesOf = (text: string, part: string): number[] => [...text.matchAll(new RegExp(escapeRegExp(part), "gu"))].map((match) => match.index);

/**
 * 文の at にある語が、定義の名前 name（語を含む、語より長い名前）の写しの中にあるか（Board of Directors (the "Board") より前の
 * Board of Directors、株式会社エムケイシステム（以下「会社」）より前の株式会社エムケイシステム）。写しは名前の終わりまで同じで、
 * 頭は名前の語の切れ目から。
 */
export const echoesName = (sentence: Sentence, at: number, term: string, name: string): boolean =>
  name !== term &&
  indexesOf(name, term).some((index) => {
    if (!sentence.text.startsWith(name.slice(index + term.length), at + term.length)) return false;
    const shared = Math.min(index, sharedTail(name.slice(0, index), sentence.text.slice(0, at)));
    const start = wordStartFrom(name, index - shared, index);
    return start !== undefined && name.length - start - term.length >= MIN_ECHO;
  });

const LATIN_LETTER = /\p{Script=Latin}/u;

/** text の終わりが、文書自身を指す頭（この、本、this）か。英語の頭は語として（this の後ろに空白）、大文字小文字を問わない。 */
const endsWithSelfPrefix = (text: string, prefixes: readonly string[]): boolean =>
  prefixes.some((prefix) =>
    LATIN_LETTER.test(prefix) ? new RegExp(String.raw`(?<![\p{L}\p{N}])${escapeRegExp(prefix)}\s+$`, "iu").test(text) : text.endsWith(prefix),
  );

/** 定義が文書自身の名前か（この就業規則（以下「規則」）、本規程（以下「規程」）、This Agreement … (this "Agreement")）。 */
export const namesItself = (defining: DefiningName, prefixes: readonly string[]): boolean =>
  endsWithSelfPrefix(defining.head, prefixes) ||
  endsWithSelfPrefix(defining.before, prefixes) ||
  prefixes.some((prefix) => !LATIN_LETTER.test(prefix) && defining.name.startsWith(prefix));

/** 文の at の語の前が、文書自身を指す頭か（この規則、this Agreement）。 */
export const followsSelfPrefix = (sentence: Sentence, at: number, prefixes: readonly string[]): boolean =>
  endsWithSelfPrefix(sentence.text.slice(0, at), prefixes);

/** 前の語を見るのに遡る字の数。 */
const LOOK_BEHIND_CHARS = 80;
/** 語の前が、文の頭ではない大文字の語か（Navistar Financial Corporation の Corporation）。The Company の The は文の頭なので当たらない。 */
const AFTER_CAPITALISED_WORD = /\p{L}[ \u00a0]\p{Lu}[\p{L}\p{N}&'’-]*[ \u00a0]$/u;

/** 英語の語が、前の大文字の語から続く長い名前の終わりにあるか。 */
export const endsLatinName = (sentence: Sentence, at: number, term: string): boolean =>
  LATIN_LETTER.test(term.charAt(0)) && AFTER_CAPITALISED_WORD.test(sentence.text.slice(Math.max(0, at - LOOK_BEHIND_CHARS), at));

/** 語のすぐ後ろの括弧とその中身（こども性暴力防止法（…に関する法律）の（…に関する法律））。 */
const GLOSS_AFTER = /^\s*[（(]([^）)]*)[）)]/u;

/** 文の at の語が、すぐ後ろの括弧に定義の長い名前を書き添えているか。語の意味はその場で分かる。 */
export const glossedWithName = (sentence: Sentence, at: number, term: string, name: string): boolean => {
  const gloss = GLOSS_AFTER.exec(sentence.text.slice(at + term.length))?.[1];
  return gloss !== undefined && name.length >= term.length + MIN_ECHO && gloss.trim().endsWith(name);
};
