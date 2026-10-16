import type { Heading } from "../document.ts";
import type { NumberingContext, StructurePatterns } from "../plugin.ts";
import type { Line } from "./lines.ts";

/** Hashes with no space before the words: 「##第一四条 （存続条項）」. CommonMark reads the line as a paragraph. */
const UNSPACED = /^ {0,3}(?<hashes>#{1,6})(?<words>[^#\s].*)$/u;

const ON_HEADING: NumberingContext = { open: [], isHeading: true };

/**
 * Lines (by number) written as a heading without the space after the hashes, kept only when the language reads the words as an article or
 * a chapter. The writer's neighbours are headings of the same shape, so reading this one as a paragraph puts a gap in the
 * article numbers that is not in the document. 「#タグ」 and 「#1 の件」 stay text.
 */
export const unspacedHeadings = (lines: readonly Line[], headed: ReadonlyMap<number, Heading>, patterns: StructurePatterns): [number, Heading][] =>
  lines.flatMap((line) => {
    if (headed.has(line.number)) return [];
    const groups = UNSPACED.exec(line.text)?.groups;
    const hashes = groups?.["hashes"];
    const words = groups?.["words"]?.trim();
    if (hashes === undefined || words === undefined) return [];
    const kind = patterns.numbered(words, ON_HEADING)?.kind;
    if (kind !== "article" && kind !== "chapter") return [];
    const heading: Heading = { depth: hashes.length, text: words, start: line.start, end: line.start + line.text.length };
    const entry: [number, Heading] = [line.number, heading];
    return [entry];
  });
