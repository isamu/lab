/**
 * 一文字を - で語の前に繋いだ名前（J-STAGE、X-RAY、T-Mobile、e-Gov）。前の一文字が新しい名前を作るので、中の大文字の語は
 * 略語ではない（J-STAGE は STAGE の説明を待たない）。後ろに一文字を繋いだ語（ITU-T、GOODS-S）は略語の一種で、略語は
 * 説明を待つまま。部品が二つとも二文字以上（RT-PCR）なら繋いだ略語のまま。
 */

type Span = { readonly start: number; readonly end: number };

const LETTER_JOINED_NAME = /(?<![A-Za-z0-9_&.-])[A-Za-z]-[A-Za-z]{2,}(?![A-Za-z0-9_&-]|\.[A-Za-z0-9])/gu;

/** 文の中の、一文字を - で語の前に繋いだ名前の範囲。 */
export const letterJoinedNameSpans = (text: string): Span[] =>
  [...text.matchAll(LETTER_JOINED_NAME)].map((match) => ({ start: match.index, end: match.index + match[0].length }));
