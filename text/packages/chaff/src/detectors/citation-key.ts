/**
 * 仕様書が参考文献を指す角括弧の見出し語（[RFC9110]、[HPACK]、[SECURING-WEB]）。中身は文献一覧の見出しで、読み手はそこへ
 * 飛ぶので、略語として展開を求めない。空白を含まない 1 語だけを見る。Markdown のリンク（[DRI](/url)、[DRI][ref]）と
 * 参照の定義（[DRI]: /url）は括弧の後ろの記号で外し、その中の語は略語のまま数える。
 */

type Span = { readonly start: number; readonly end: number };

const CITATION_KEY = /(?<![\p{L}\p{N}_!\]])\[[A-Za-z][A-Za-z0-9.-]*[A-Za-z0-9]\](?![([:])/gu;

/** 文の中の、参考文献の見出し語の範囲（括弧を含む）。 */
export const citationKeySpans = (text: string): Span[] =>
  [...text.matchAll(CITATION_KEY)].map((match) => ({ start: match.index, end: match.index + match[0].length }));
