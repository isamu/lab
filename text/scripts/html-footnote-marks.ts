// A footnote's reference mark: a superscript that is a link (<sup><a …>1</a></sup>), or a link to a place on the same
// page holding nothing but a superscript (<a href="#fn1"><sup>1</sup></a>). Read as text the number sticks to the
// sentence it follows ("recessions.1 Over"), so the mark is dropped; the note itself stays where the page has it. A
// superscript that is a link is a mark wherever the link goes (the notes may be on another page); a link around a
// superscript is one only when it stays on this page, since "Brand<a href=…><sup>TM</sup></a>" is a sign. A superscript
// with no link ("25<sup>th</sup>") is text. Pure.

const LINK_IN_SUPERSCRIPT = /<sup\b[^>]*>\s*<a\b[^>]*>[^<]*<\/a\s*>\s*<\/sup\s*>/giu;

const SUPERSCRIPT_LINK = /<a\b([^>]*)>\s*<sup\b[^>]*>([^<]*)<\/sup\s*>\s*<\/a\s*>/giu;

// The fragment must name something: href="#" alone goes nowhere and is a control.
const IN_PAGE_HREF = /\shref\s*=\s*(?:"#[^"\s]+"|'#[^'\s]+'|#[^\s"'>]+)/iu;

const isFootnoteLink = (attributes: string, mark: string): boolean => IN_PAGE_HREF.test(attributes) && mark.trim() !== "";

export const withoutFootnoteMarks = (html: string): string =>
  html
    .replace(LINK_IN_SUPERSCRIPT, "")
    .replace(SUPERSCRIPT_LINK, (link: string, attributes: string, mark: string) => (isFootnoteLink(attributes, mark) ? "" : link));
