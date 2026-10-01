import type { Detector, Finding } from "../plugin.ts";
import { quoteAround } from "./quote-around.ts";

/**
 * 字で終わる語のすぐ後ろの半角空白一つと、それに続く句読点（"word ."、"word ,"）。句読点の後ろは空白か行の終わりか閉じの記号で、
 * ".NET" や ".5" のように次の語の頭の点は数えない。数の後ろ（式の "[ 1 , N ]"）と、"Note : " "ISSN : " のように欄の印として空けるコロンは見ない。
 */
const SPACED_MARK = /(?<=\p{L}) (?=[.,;?!](?:[\s)\]"'”’]|$))/gu;

/** 空白で区切った点の並び（". . ."）。省略の印と、目次の点線。 */
const SPACED_DOTS = /^\. ?\./u;

const DOTS_REACH = 3;

const isSpacedEllipsis = (text: string, space: number): boolean => SPACED_DOTS.test(text.slice(space + 1, space + 1 + DOTS_REACH));

/**
 * 本文（prose）の中の、句読点の前の空白の位置。prose はコード・URL・強調の印を空白で覆うので、覆ってできた空白（"*word* ." の "*"）は
 * 書き手が打った空白ではない。source の同じ位置も空白のときだけ数える。
 */
export const spacesBeforePunctuation = (prose: string, source: string): number[] =>
  [...prose.matchAll(SPACED_MARK)].map((match) => match.index).filter((space) => source.charAt(space) === " " && !isSpacedEllipsis(prose, space));

export const spaceBeforePunctuation: Detector = (doc): Finding[] =>
  spacesBeforePunctuation(doc.prose ?? doc.source, doc.source).map((space) => ({
    rule: "",
    severity: "warning",
    line: 0,
    column: 0,
    quote: quoteAround(doc.source, space, space + 2),
    values: { mark: doc.source.charAt(space + 1), offset: space },
  }));
