// 引用符の中身。英語の ’ と ' はアポストロフィ（organisation’s, don't）にも使われるので、字のあとに続くものは閉じとみなさない。
const QUOTATIONS: readonly RegExp[] = [
  /“([^“”\n]*)”/gu,
  /‘((?:[^‘’\n]|’(?=\p{L}))*)’(?!\p{L})/gu,
  /"([^"\n]*)"/gu,
  /(?<![\p{L}\p{N}])'((?:[^'\n]|'(?=\p{L}))*)'(?![\p{L}\p{N}])/gu,
  /「([^「」\n]*)」/gu,
  /『([^『』\n]*)』/gu,
];

// 大文字小文字は畳まない。表記の手引きは大文字小文字だけ違う形も引用して退ける（Not “Open Source software”）。
const sameText = (left: string, right: string): boolean => left.trim() === right.trim();

/**
 * 文から、見出しとは違う形を引用した部分を抜いた文字列。
 * 「Not “datacentre”.」の “datacentre” は語の書き方として挙げたもの（言及）で、見出し「data centre」を繰り返してはいない。
 * 見出しそのままの引用（「利用規約への同意」について説明します）は見出しを指しているので残す。
 */
export const withoutQuotedVariants = (sentence: string, heading: string): string =>
  QUOTATIONS.reduce((text, quotation) => text.replace(quotation, (whole: string, inner: string) => (sameText(inner, heading) ? whole : " ")), sentence);
