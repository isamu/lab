import type { Span, Token } from "../plugin.ts";

const KANJI_OR_HIRAGANA = /[一-鿿ぁ-ゖ]/u;

/**
 * 括弧の中身（span: 括弧を除いた範囲）が、漢字の連なり [start, end) と、漢字も平仮名も無い語（ページ、センター、Ｗｅｂ）だけか。
 * 書き手が括弧でくくって 1 つの名前と示したもの（「登録業者情報検索入力ページ」）。平仮名があれば、括弧の中は文や句。
 */
export const holdsName = (text: string, span: Span, start: number, end: number): boolean =>
  span.start <= start && end <= span.end && !KANJI_OR_HIRAGANA.test(text.slice(span.start, start) + text.slice(end, span.end));

/** 連なりの前（before: 文の頭から連なりまで）が、空白を挟んだ法人格で終わるか（一般社団法人 全国銀行個人信用情報センター）。 */
export const followsForm = (before: string, forms: readonly string[]): boolean => {
  const trimmed = before.trimEnd();
  return trimmed !== before && forms.some((form) => trimmed.endsWith(form));
};

/**
 * 連なり（文書全体の座標で start から始まる）の頭の、前に書いたものを指す語（上記、当該）。解析がその語を別の語に分け、
 * 後ろに語が残るときだけ。読み手は指す語と後ろの語の切れ目を迷わない。
 */
export const leadingReference = (tokens: readonly Token[], start: number, name: string, references: readonly string[]): Token | undefined => {
  const token = tokens.find((candidate) => candidate.span.start === start);
  if (token === undefined || !references.includes(token.surface)) return undefined;
  return name.startsWith(token.surface) && name.length > token.surface.length ? token : undefined;
};
