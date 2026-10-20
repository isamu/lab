const LETTER = /\p{L}/u;
/** 文頭の、語の前の記号と空白（引用符、Markdown の印）。接続詞の判定（最初の語）と同じに飛ばす。 */
const LEADING_NON_LETTERS = /^\P{L}*/u;

/**
 * 文が語彙表の言い回し（So far、Yet another）で始まるか。接続詞と同じ語で始まるが、副詞の句で、文を前の文につなぐ接続詞ではない。
 * 大文字小文字は問わず、頭の記号（“So far）は飛ばし、言い回しの後ろは語の切れ目（So farther は So far ではない）。
 */
export const opensWithPhrase = (text: string, phrases: readonly string[]): boolean => {
  const head = text.replace(LEADING_NON_LETTERS, "").toLowerCase();
  return phrases.some((phrase) => {
    const lower = phrase.toLowerCase();
    return lower !== "" && head.startsWith(lower) && !LETTER.test(head.charAt(lower.length));
  });
};
