// A 青空文庫 XHTML file (www.aozora.gr.jp/cards/…/files/….html) as the work alone, in Markdown. After the text, 青空文庫
// closes every file with its colophon: the 底本 (the printed edition transcribed), who typed and proofread it, the dates
// it was published and fixed, a note on the notation, and a link to the work's card. That is 青空文庫's record of the
// file, not the author's writing, so, as the Gutenberg format drops Project Gutenberg's header and licence, it is not
// kept. The colophon is told by the blocks 青空文庫 marks it with (bibliographical_information, notation_notes); the rest
// of the page goes through the HTML converter as before. For the same reason the transcriber's ［＃…］ notes in the
// text (span.notes: a page break, 「…」はママ, 「…」は底本では「…」) are dropped. Pure.
import { elementRanges, plainText, withoutElementsWhere, type ElementRange } from "../packages/chaff/src/html/html-elements.ts";
import { htmlToMarkdown } from "../packages/chaff/src/html/html-markdown.ts";

const COLOPHON_CLASS = /^<div\b[^>]*\bclass\s*=\s*(["'])(?:[^"']*\s)?(?:bibliographical_information|notation_notes)(?:\s[^"']*)?\1/iu;

const isColophon = (range: ElementRange): boolean => COLOPHON_CLASS.test(range.openTag);

const NOTES_CLASS = /^<span\b[^>]*\bclass\s*=\s*(["'])(?:[^"']*\s)?notes(?:\s[^"']*)?\1/iu;

const NOTE_TEXT = /^［＃.*］$/u;

// A character 青空文庫 cannot encode is typed as ※ and a note naming it (［＃「曾＋りっとう」、17-6］); that note stands
// for the character, so it stays.
const CHARACTER_NOTE = /^［＃「.*」、(?:第\d水準|U\+[0-9A-F]|\d+-\d+)/iu;

const isInputNote = (range: ElementRange): boolean => {
  const text = plainText(range.inner);
  return NOTES_CLASS.test(range.openTag) && NOTE_TEXT.test(text) && !CHARACTER_NOTE.test(text);
};

// Cut with nothing in its place: a space would split the Japanese sentence the note sat in.
const withoutInputNotes = (html: string): string => {
  const cut = elementRanges(html, "span")
    .filter(isInputNote)
    .reduce<{ readonly parts: readonly string[]; readonly from: number }>(
      (acc, range) => (range.start < acc.from ? acc : { parts: [...acc.parts, html.slice(acc.from, range.start)], from: range.end }),
      { parts: [], from: 0 },
    );
  return [...cut.parts, html.slice(cut.from)].join("");
};

export const aozoraToMarkdown = (html: string): string => htmlToMarkdown(withoutInputNotes(withoutElementsWhere(html, "div", isColophon)));
