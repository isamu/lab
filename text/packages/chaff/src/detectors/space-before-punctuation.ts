import type { Detector, Finding, Span } from "../plugin.ts";
import { referenceListSpans } from "../reference-lists.ts";
import { quoteAround } from "./quote-around.ts";

/**
 * 字で終わる語（閉じ括弧や閉じ引用符が一つ付いてもよい）のすぐ後ろの半角空白一つと、それに続く句読点（"word ."、"(word) ,"）。句読点の後ろは空白か行の終わりか閉じの記号で、
 * ".NET" や ".5" のように次の語の頭の点は数えない。数の後ろ（式の "[ 1 , N ]"）と、"Note : " "ISSN : " のように欄の印として空けるコロンは見ない。
 */
const SPACED_MARK = /(?<=\p{L}[)\]}"'”’]?) (?=[.,;?!](?:[\s)\]"'”’]|$))/gu;

/** 空白で区切った点の並び（". . ."）。省略の印と、目次の点線。 */
const SPACED_DOTS = /^\. ?\./u;

const DOTS_REACH = 3;

const isSpacedEllipsis = (text: string, space: number): boolean => SPACED_DOTS.test(text.slice(space + 1, space + 1 + DOTS_REACH));

/** 文献一覧で、値を落とした欄の名前（"ISBN ,"）。大文字だけの名前のすぐ後ろが読点になるのは、文献の書式が空の値を埋めたところ。 */
const EMPTY_FIELD_LABEL = /(?:^|[^\p{L}])\p{Lu}{2,}$/u;

/** 欄の名前を探す字数。どの欄の名前よりも長い。 */
const LABEL_REACH = 16;

const isEmptyField = (text: string, space: number, references: readonly Span[]): boolean =>
  text.charAt(space + 1) === "," &&
  references.some((span) => span.start <= space && space < span.end) &&
  EMPTY_FIELD_LABEL.test(text.slice(Math.max(0, space - LABEL_REACH), space));

/**
 * 本文（prose）の中の、句読点の前の空白の位置。prose はコード・URL・強調の印を空白で覆うので、覆ってできた空白（"*word* ." の "*"）は
 * 書き手が打った空白ではない。source の同じ位置も空白のときだけ数える。
 */
export const spacesBeforePunctuation = (prose: string, source: string, references: readonly Span[] = []): number[] =>
  [...prose.matchAll(SPACED_MARK)]
    .map((match) => match.index)
    .filter((space) => source.charAt(space) === " " && !isSpacedEllipsis(prose, space) && !isEmptyField(prose, space, references));

const referencesOf = (source: string, headingWords: readonly { readonly pattern: string }[] | undefined): Span[] =>
  referenceListSpans(
    source,
    (headingWords ?? []).map((entry) => entry.pattern),
  );

export const spaceBeforePunctuation: Detector = (doc): Finding[] =>
  spacesBeforePunctuation(doc.prose ?? doc.source, doc.source, referencesOf(doc.source, doc.lexicons["reference-list-heading"])).map((space) => ({
    rule: "",
    severity: "warning",
    line: 0,
    column: 0,
    quote: quoteAround(doc.source, space, space + 2),
    values: { mark: doc.source.charAt(space + 1), offset: space },
  }));
