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
export const withoutWordBrackets = (text: string, annotations: readonly string[]): string =>
  disjointFromEnd([...readingSpans(text), ...annotationSpans(text, annotations)]).reduce(
    (rest, span) => `${rest.slice(0, span.start)}${rest.slice(span.end)}`,
    text,
  );
