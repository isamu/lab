/**
 * . で空白を挟まずに繋いだ語（GOV.UK、SAM.gov、README.md、ASP.NET）。ドメイン名やファイル名で、中の大文字は略語ではない。
 * 文の終わりの . は後ろに空白か行末が来る（…by the IRS. Then）ので、ここには当たらない。空白を落とした文の境目
 * （the IRS.Then、Mr.HAWLEY）は頭だけ大文字の部品で分かるので、部品は全部大文字か全部小文字（と数字）に限る。
 */

type Span = { readonly start: number; readonly end: number };

const LABEL = "(?:[A-Z0-9][A-Z0-9-]*|[a-z0-9][a-z0-9-]*)";
const DOTTED_NAME = new RegExp(String.raw`(?<![A-Za-z0-9_&.-])${LABEL}(?:\.${LABEL})+(?![A-Za-z0-9_&])`, "gu");

/** 文の中の、. で繋いだ名前の範囲。 */
export const dottedNameSpans = (text: string): Span[] =>
  [...text.matchAll(DOTTED_NAME)].map((match) => ({ start: match.index, end: match.index + match[0].length }));
