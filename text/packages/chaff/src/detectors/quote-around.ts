/** 見せる前後の字数。記号 1 つの指摘は、周りの言葉が無いとどこか分からない。 */
const QUOTE_REACH = 20;

/** text の start から end の前後を、空白をならして引く。 */
export const quoteAround = (text: string, start: number, end: number = start + 1): string =>
  text
    .slice(Math.max(0, start - QUOTE_REACH), end + QUOTE_REACH)
    .replace(/\s+/gu, " ")
    .trim();
