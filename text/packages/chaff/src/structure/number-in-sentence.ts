/** 大文字と小文字のある文字で、小文字の語。節の題（「3.1 Scope」「4.2 The Supplier shall」）は小文字で始まらない。 */
const LOWERCASE_WORD = /^\p{Ll}/u;

/** 文の終わり。ピリオドは後ろが空白か行末のとき（「3.x」「e-Tax.nta」の点は文を終えない）。題は文として終わらない。 */
const SENTENCE_END = /[.!?](?=\s|$)|[。！？]/u;

/** 行頭の通し番号の行。rest は番号の後ろ。 */
export type NumberedText = { readonly number: string; readonly rest: string; readonly isHeading: boolean };

type ContinuesSentence = (number: string, rest: string) => boolean;

/**
 * 本文の行の「3.11.0 was released on 2024-10-17.」「3.11.0 を公開しました。」の番号は、文の主語や目的語で、節の番号ではない。
 * 続きが文として終わり、しかも小文字の語で始まるか、言語パッケージが文の続き（日本語なら助詞）と読んだとき。
 * 小文字の題（「3.1 overview」「4.2.1.  about:blank」）と見出しの行は章番号。
 */
export const numberInSentence = (numbered: NumberedText, continuesSentence?: ContinuesSentence): boolean =>
  !numbered.isHeading &&
  SENTENCE_END.test(numbered.rest) &&
  (LOWERCASE_WORD.test(numbered.rest) || continuesSentence?.(numbered.number, numbered.rest) === true);
