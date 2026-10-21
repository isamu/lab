import { furiganaSpans } from "./furigana.ts";
import { escapeRegExp } from "./orthography.ts";
import type { Span } from "./plugin.ts";

/** 読みを付ける字（漢字）と、添え書きを付ける名前の終わりの字（漢字・カタカナ）。ひらがなの後ろの括弧は挟んだ言葉（これは（たぶん））。 */
const KANJI = /\p{Script=Han}/u;
const NAME_END = /[\p{Script=Han}\p{Script=Katakana}ー]/u;
const HIRAGANA = /\p{Script=Hiragana}/u;
/** 括弧の後ろに来ると、括弧の中は語の読みでなく挟んだ言葉と読む一字の助詞（対象（すべて）を）。送り仮名（拓（ひら）く）は語の続き。 */
const PARTICLES: ReadonlySet<string> = new Set(["を", "が", "に", "は", "で", "と", "の", "も", "へ", "や", "か"]);

/** 語の中に書いた読み（拓（ひら）く）。漢字の後ろの読みの括弧で、後ろに送り仮名が続き、語が括弧をまたいで続くものだけ。 */
const readingSpans = (text: string): Span[] =>
  furiganaSpans(text).filter((span) => {
    const after = text.charAt(span.end);
    return KANJI.test(text.charAt(span.start - 1)) && HIRAGANA.test(after) && !PARTICLES.has(after);
  });

/** 名前のすぐ後ろに付けた添え書き（栄養教諭（仮称）、計画（案））。words は語彙表 bracket-annotation の語。 */
const annotationSpans = (text: string, words: readonly string[]): Span[] => {
  if (words.length === 0) return [];
  const pattern = new RegExp(`[（(](?:${words.map(escapeRegExp).join("|")})[）)]`, "gu");
  return [...text.matchAll(pattern)]
    .filter((match) => NAME_END.test(text.charAt(match.index - 1)))
    .map((match) => ({ start: match.index, end: match.index + match[0].length }));
};

/**
 * 英字や数字にすぐ続けた短い括弧の並び。条文の項の印（12 U.S.C. § 1813(h)、section 5(a)(1)）と語の終わり（item(s)）で、
 * 読み手は番号や語の一部として読む。括弧の中は 3 桁までの数字か 4 字までの英字（(iv)）だけ。
 */
const LABEL_MARKS = /(?<=[A-Za-z0-9])(?:\((?:\d{1,3}|[A-Za-z]{1,4})\))+/gu;

/** 引用の中で大文字・小文字を改めた一字の印（“[A] musical composition”、[a]ll）。語の頭の一字で、括弧として読まない。 */
const ALTERATION = /\[\p{L}\]/gu;

const spansOfPattern = (text: string, pattern: RegExp): Span[] =>
  [...text.matchAll(pattern)].map((match) => ({ start: match.index, end: match.index + match[0].length }));

/** 定義の括弧で、定義の語（以下、hereinafter）と定義の動詞（という）の間に置く語を囲んだ引用符。語彙表 definition-marker と definition-verb から。 */
export type DefinitionWords = { readonly markers: readonly string[]; readonly verbs: readonly string[] };

const oneOf = (words: readonly string[]): string => words.map(escapeRegExp).join("|");

/**
 * 定義の括弧の中で、定義する語を囲んだ引用符（（以下「PHR」という。）、(hereinafter “SLA”)、(“Exchange Act”)）。引用符は語の
 * 名前の印で、読み手が開いたまま覚えておく括弧ではない。前は定義の語か開き括弧、後ろは定義の動詞か閉じ括弧のときだけ。外すのは引用符の二字だけ。
 */
const definedTermQuoteSpans = (text: string, words: DefinitionWords): Span[] => {
  const markers = words.markers.length === 0 ? "" : String.raw`(?<![\p{L}\p{N}])(?:${oneOf(words.markers)})[\s、,]*|`;
  const verbs = words.verbs.length === 0 ? "" : `${oneOf(words.verbs)}|`;
  const pattern = new RegExp(String.raw`(?:${markers}[(（]\s*)(?<open>[「“"])[^「」“”"\n]{1,40}[」”"](?=\s*(?:${verbs}[)）]))`, "giu");
  return [...text.matchAll(pattern)].flatMap((match) => {
    const end = match.index + match[0].length;
    const open = match.index + match[0].indexOf(match.groups?.["open"] ?? "");
    return [
      { start: open, end: open + 1 },
      { start: end - 1, end },
    ];
  });
};

/** 重ならない範囲だけを、後ろから。同じ括弧が読みとしても添え書きとしても当たれば、一度だけ外す。 */
const disjointFromEnd = (spans: readonly Span[]): Span[] =>
  spans
    .toSorted((left, right) => left.start - right.start)
    .reduce<Span[]>((kept, span) => (span.start >= (kept.at(-1)?.end ?? 0) ? [...kept, span] : kept), [])
    .reverse();

/**
 * 語の一部として書いた括弧（読みの 拓（ひら）く、添え書きの 栄養教諭（仮称））を除いた text。読み手はこれを語として読み、
 * 開いた括弧として覚えておく必要が無いので、括弧の重なりに数えない。挟んだ言葉（本文（氏名（ふりがな））、対象（すべて）を）は残す。
 */
export const withoutWordBrackets = (text: string, annotations: readonly string[], definitions: DefinitionWords = { markers: [], verbs: [] }): string =>
  disjointFromEnd([
    ...readingSpans(text),
    ...annotationSpans(text, annotations),
    ...spansOfPattern(text, LABEL_MARKS),
    ...spansOfPattern(text, ALTERATION),
    ...definedTermQuoteSpans(text, definitions),
  ]).reduce((rest, span) => `${rest.slice(0, span.start)}${rest.slice(span.end)}`, text);
