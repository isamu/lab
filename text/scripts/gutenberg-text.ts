// A Project Gutenberg plain-text eBook (gutenberg.org/cache/epub/<n>/pg<n>.txt) as the work alone: the lines between
// the "*** START OF THE PROJECT GUTENBERG EBOOK … ***" and "*** END OF … ***" markers, with Unix line ends. The
// header and the licence after the end marker are Project Gutenberg's, not the author's; without them the text is the
// public-domain work, which the licence allows to be shared freely. A text without the markers is kept whole. Pure.

const START = /^\*\*\* ?START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK\b.*$/mu;
const END = /^\*\*\* ?END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK\b.*$/mu;

const between = (text: string): string => {
  const start = START.exec(text);
  const from = start === null ? 0 : start.index + start[0].length;
  const end = END.exec(text.slice(from));
  return end === null ? text.slice(from) : text.slice(from, from + end.index);
};

export const gutenbergText = (fetched: string): string => `${between(fetched.replace(/\r\n?/gu, "\n")).replace(/^\n+/u, "").trimEnd()}\n`;
