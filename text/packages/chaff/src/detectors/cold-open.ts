import type { Detector, Finding, Lexicon, LexiconEntry, ProseDocument, Sentence } from "../plugin.ts";
import { lengthOf } from "../measure.ts";
import { quotedSpans, QUOTATION_MARKS } from "../quoted-span.ts";
import { escapeRegExp } from "../orthography.ts";
import { comparableText, comparableWords, entryIn, entryOpens, entryRanges } from "./lexicon-match.ts";

// 書き出しの 3 つの形。語は言語パッケージの語彙表が持ち、ここは形だけを知る。
//   open / end: 最初の文が、その語で始まる・終わる短い願い（〜したい。 / You want to …）
//   echo:       前の文の語を、指す語のすぐ後ろの引用符で引き直す（この「だいたい」が / That ‘almost’）
//   teaser:     易しく見せてから難所を予告する（それだけのことに見えて / Sounds simple.）

/** 書き出しとして読む文の数。人の記事でも、ここまでに状況か例が出る。 */
export const OPENING_SENTENCES = 8;

/** 願いが「短い」と言える長さ（和文は字、英文は語）。 */
const SHORT_WISH = { char: 40, word: 15 };

/** 引き直した語の長さの上限（和文は字、英文は語）。長い引用は言葉の引用で、語の引き直しではない。 */
const ECHO_SPAN = { char: 10, word: 3 };

/** 英文で語を引き直す一重の引用符（‘almost’）。直線の ' は省略の印と見分けられないので読まない。 */
const ECHO_MARKS = { ...QUOTATION_MARKS, "‘": "’" };

/** 文末の句点・感嘆符・閉じ括弧。 */
const SENTENCE_END = new Set('。．.!！?？」』”"’)）');

/** 文末の記号と空白を除いた文。 */
const withoutEnd = (text: string): string => {
  const chars = [...text];
  const last = chars.findLastIndex((char) => !SENTENCE_END.has(char) && char.trim() !== "");
  return chars.slice(0, last + 1).join("");
};

export type ColdOpenShape = "wish" | "echo" | "teaser";

export type ColdOpenHit = { readonly shape: ColdOpenShape; readonly sentence: Sentence; readonly matched: string };

const inGroup = (lexicon: Lexicon, group: string): LexiconEntry[] => lexicon.filter((entry) => entry.group === group);

/** 書き出しの文：最初の段落から順に、箇条書きと文書と違う言語の文を除いて。 */
export const openingSentences = (doc: ProseDocument): Sentence[] =>
  doc.paragraphs
    .flatMap((paragraph) => paragraph.sentences)
    .filter((sentence) => sentence.listItem !== true && sentence.embeddedLanguage === undefined)
    .slice(0, OPENING_SENTENCES);

const TRAILING_MARK = new Set(["PUNCT", "SYM"]);

/** 文が語彙表の語で終わるか。品詞があれば語の並びで照らすので、「みたい」は「たい」に当たらない。 */
const endsWith = (sentence: Sentence, entry: LexiconEntry): boolean => {
  const tokens = sentence.tokens;
  if (tokens === undefined || entry.tokens === undefined || entry.tokens.length === 0)
    return withoutEnd(comparableText(sentence)).endsWith(comparableWords(entry.pattern));
  const last = tokens.findLastIndex((token) => !TRAILING_MARK.has(token.pos) && token.surface.trim() !== "");
  return entryRanges(sentence, entry).some((range) => range.end === last + 1);
};

/** 最初の文が、語彙表の語で始まるか終わる短い願いか。 */
export const wishOpening = (first: Sentence | undefined, lexicon: Lexicon, unit: "char" | "word"): ColdOpenHit[] => {
  if (first === undefined || lengthOf(first, unit) > SHORT_WISH[unit]) return [];
  const entry = inGroup(lexicon, "open").find((open) => entryOpens(first, open)) ?? inGroup(lexicon, "end").find((end) => endsWith(first, end));
  return entry === undefined ? [] : [{ shape: "wish", sentence: first, matched: first.text.trim() }];
};

const isWordChar = (char: string | undefined): boolean => char !== undefined && /[\p{L}\p{N}]/u.test(char);

/** 定義を置く括弧の開き。契約の (this "Agreement") は語の引き直しではなく定義。 */
const DEFINITION_OPEN = new Set(["(", "（"]);

/** 引用符の直前が、語彙表の指す語（この、That）で終わるか。英字の語は語の途中に当たらない。 */
const pointedAt = (before: string, pointers: readonly LexiconEntry[]): LexiconEntry | undefined => {
  const head = comparableWords(before).trimEnd();
  return pointers.find((pointer) => {
    const word = comparableWords(pointer.pattern);
    if (!head.endsWith(word)) return false;
    const preceding = head.slice(0, -word.length).trimEnd().at(-1);
    return !DEFINITION_OPEN.has(preceding ?? "") && !(/^[a-z]/u.test(word) && isWordChar(head.at(-word.length - 1)));
  });
};

/** 引用符で引いたところを空白にした文。前の文でも引用符の中にある語は、引き直しではなく同じ語の言及。位置は変えない。 */
const unquoted = (text: string): string => {
  const quoted = quotedSpans(text, ECHO_MARKS);
  return text
    .split("")
    .map((char, at) => (quoted.some((span) => at >= span.start - 1 && at <= span.end) ? " " : char))
    .join("");
};

/** 前の文に、引いた語がそのまま出るか。英字の語は語の途中（database の base）に当たらない。 */
const occursIn = (previous: string, word: string, unit: "char" | "word"): boolean =>
  unit === "char" ? previous.includes(word) : new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(word)}(?![\\p{L}\\p{N}])`, "u").test(previous);

const spanLength = (text: string, unit: "char" | "word"): number =>
  unit === "char" ? text.replace(/\s+/gu, "").length : text.split(/\s+/u).filter(Boolean).length;

/** 前の文の語を、指す語の後ろの引用符で引き直した文（この「だいたい」が困ります）。 */
export const echoQuotes = (sentences: readonly Sentence[], lexicon: Lexicon, unit: "char" | "word"): ColdOpenHit[] => {
  const pointers = inGroup(lexicon, "echo");
  if (pointers.length === 0) return [];
  return sentences.slice(1).flatMap((sentence, index) => {
    const previous = comparableWords(unquoted(sentences[index]?.text ?? ""));
    const echoed = quotedSpans(sentence.text, ECHO_MARKS).find((span) => {
      const inner = sentence.text.slice(span.start, span.end).trim();
      if (inner === "" || spanLength(inner, unit) > ECHO_SPAN[unit]) return false;
      return pointedAt(sentence.text.slice(0, span.start - 1), pointers) !== undefined && occursIn(previous, comparableWords(inner), unit);
    });
    return echoed === undefined ? [] : [{ shape: "echo" as const, sentence, matched: sentence.text.slice(echoed.start, echoed.end).trim() }];
  });
};

/** 易しく見せてから難所を予告する言い回し。 */
export const teasers = (sentences: readonly Sentence[], lexicon: Lexicon): ColdOpenHit[] => {
  const phrases = inGroup(lexicon, "teaser");
  return sentences.flatMap((sentence) => {
    const entry = phrases.find((phrase) => entryIn(sentence, phrase));
    return entry === undefined ? [] : [{ shape: "teaser" as const, sentence, matched: entry.pattern }];
  });
};

/** 書き出しに出た形。形ごとに最初の 1 つ。 */
export const coldOpenHits = (doc: ProseDocument, lexicon: Lexicon): ColdOpenHit[] => {
  const opening = openingSentences(doc);
  const found = [...wishOpening(opening[0], lexicon, doc.lengthUnit), ...echoQuotes(opening, lexicon, doc.lengthUnit), ...teasers(opening, lexicon)];
  return [...new Map(found.map((hit) => [hit.shape, hit])).values()];
};

/**
 * 状況も例もなく始まる書き出し。形 1 つは人の文書にもある（提案の「〜したい。」、定義の言い直し）。
 * limit は書き出しに要る形の数で、重なったときだけ、形ごとの文を言う。
 */
export const coldOpen: Detector = (doc, options): Finding[] => {
  const hits = coldOpenHits(doc, options.lexicon ?? []);
  if (hits.length === 0 || hits.length < options.limit) return [];
  return hits
    .toSorted((a, b) => a.sentence.span.start - b.sentence.span.start)
    .map((hit) => ({
      rule: "",
      severity: "info",
      line: 0,
      column: 0,
      quote: hit.sentence.text.trim(),
      values: { matched: hit.matched, count: hits.length, limit: options.limit, offset: hit.sentence.span.start },
    }));
};
