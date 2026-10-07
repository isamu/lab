// A 青空文庫 XHTML file (www.aozora.gr.jp/cards/…/files/….html) as the work alone, in Markdown. After the text, 青空文庫
// closes every file with its colophon: the 底本 (the printed edition transcribed), who typed and proofread it, the dates
// it was published and fixed, a note on the notation, and a link to the work's card. That is 青空文庫's record of the
// file, not the author's writing, so, as the Gutenberg format drops Project Gutenberg's header and licence, it is not
// kept. The colophon is told by the blocks 青空文庫 marks it with (bibliographical_information, notation_notes); the rest
// of the page goes through the HTML converter as before. Pure.
import { withoutElementsWhere, type ElementRange } from "../packages/chaff/src/html/html-elements.ts";
import { htmlToMarkdown } from "../packages/chaff/src/html/html-markdown.ts";

const COLOPHON_CLASS = /^<div\b[^>]*\bclass\s*=\s*(["'])(?:[^"']*\s)?(?:bibliographical_information|notation_notes)(?:\s[^"']*)?\1/iu;

const isColophon = (range: ElementRange): boolean => COLOPHON_CLASS.test(range.openTag);

export const aozoraToMarkdown = (html: string): string => htmlToMarkdown(withoutElementsWhere(html, "div", isColophon));
