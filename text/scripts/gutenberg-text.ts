// A Project Gutenberg plain-text eBook (gutenberg.org/cache/epub/<n>/pg<n>.txt) as the work alone: the lines between
// the "*** START OF THE PROJECT GUTENBERG EBOOK … ***" and "*** END OF … ***" markers, with Unix line ends. The
// header, a "Produced by …" credit that some eBooks put right after the start marker, and the licence after the end
// marker are Project Gutenberg's, not the author's; without them the text is the public-domain work, which the licence
// allows to be shared freely. A text without the markers is kept whole. Pure.

const START = /^\*\*\* ?START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK\b.*$/mu;
const END = /^\*\*\* ?END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK\b.*$/mu;

const between = (text: string): string => {
  const start = START.exec(text);
  const from = start === null ? 0 : start.index + start[0].length;
  const end = END.exec(text.slice(from));
  return end === null ? text.slice(from) : text.slice(from, from + end.index);
};

const CREDIT = "Produced by ";
const BLANK_LINE = /\n[ \t]*\n/u;

/** The volunteers' credit paragraph that opens some eBooks' text, up to the first blank line; without one, nothing is dropped. */
const withoutCredit = (text: string): string => {
  const body = text.replace(/^\n+/u, "");
  const blank = body.startsWith(CREDIT) ? BLANK_LINE.exec(body) : null;
  return blank === null ? text : body.slice(blank.index + blank[0].length);
};

export const gutenbergText = (fetched: string): string =>
  `${withoutCredit(between(fetched.replace(/\r\n?/gu, "\n")))
    .replace(/^\n+/u, "")
    .trimEnd()}\n`;
