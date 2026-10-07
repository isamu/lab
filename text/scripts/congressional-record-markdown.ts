// A Congressional Record granule as govinfo serves it (govinfo.gov/content/pkg/CREC-…/html/….htm) as plain Markdown.
// The page is one <pre> in the printed Record's layout, where only indentation marks the structure: a centred line
// is a title, two spaces open a paragraph, a deeper indent is quoted matter (its first line two spaces deeper still),
// and a line at the quote's depth with no quote open is an item of a list (the names of a roll call). The GPO
// banner, the page markers ([[Page S2257]], which split a paragraph where the printed page turns), the time stamps
// and the rules between items are dropped. Pure.
import { decodeEntities, tidyLines } from "../packages/chaff/src/html/markup-text.ts";

type Kind = "title" | "paragraph" | "quote" | "item";

type Block = { readonly kind: Kind; readonly lines: readonly string[] };

type Layout = { readonly blocks: readonly Block[]; readonly open: Block | undefined };

const TITLE_INDENT = 10;
const QUOTE_INDENT = 5;
const QUOTE_OPENING_INDENT = 7;
const PARAGRAPH_INDENT = 2;

const isPageMarker = (line: string): boolean => /^\[\[Page [^\]]*\]\]$/u.test(line.trim());

type Unmarked = { readonly lines: readonly string[]; readonly afterMarker: boolean };

const withoutTrailingBlanks = (lines: readonly string[]): readonly string[] => lines.slice(0, lines.findLastIndex((line) => line.trim() !== "") + 1);

/** The page markers and the blank lines around them, so that a paragraph the printed page split reads as one. */
const withoutPageMarkers = (lines: readonly string[]): readonly string[] =>
  lines.reduce<Unmarked>(
    (state, line) => {
      if (isPageMarker(line)) return { lines: withoutTrailingBlanks(state.lines), afterMarker: true };
      if (state.afterMarker && line.trim() === "") return state;
      return { lines: [...state.lines, line], afterMarker: false };
    },
    { lines: [], afterMarker: false },
  ).lines;

const isBanner = (line: string): boolean => line.trim() === "" || line.startsWith("[") || line.startsWith("From the Congressional Record Online");

/** The Record's own banner above the text: the volume, the chamber, the pages and the GPO line. */
const withoutBanner = (lines: readonly string[]): string[] => {
  const first = lines.findIndex((line) => !isBanner(line));
  return first === -1 ? [] : lines.slice(first);
};

const isDropped = (text: string): boolean => /^_+$/u.test(text) || text.startsWith("{time}");

const indentOf = (line: string): number => line.length - line.trimStart().length;

/** What a line opens or continues, from its indent alone; undefined for a line that only continues the open block. */
const kindOf = (indent: number, open: Block | undefined): Kind | undefined => {
  if (indent >= TITLE_INDENT) return "title";
  if (indent >= QUOTE_OPENING_INDENT) return "quote";
  if (indent >= QUOTE_INDENT) return open?.kind === "quote" ? undefined : "item";
  if (indent >= PARAGRAPH_INDENT) return "paragraph";
  return undefined;
};

const closed = (layout: Layout): readonly Block[] => (layout.open === undefined ? layout.blocks : [...layout.blocks, layout.open]);

const withLine = (layout: Layout, line: string): Layout => {
  const text = line.trim();
  if (text === "" || isDropped(text)) return { blocks: closed(layout), open: undefined };
  const kind = kindOf(indentOf(line), layout.open);
  const open = layout.open;
  if (open !== undefined && (kind === undefined || (kind === "title" && open.kind === "title"))) {
    return { blocks: layout.blocks, open: { kind: open.kind, lines: [...open.lines, text] } };
  }
  return { blocks: closed(layout), open: { kind: kind ?? "paragraph", lines: [text] } };
};

const PREFIX: Readonly<Record<Kind, string>> = { title: "## ", paragraph: "", quote: "> ", item: "- " };

const blockMarkdown = (block: Block): string => `${PREFIX[block.kind]}${block.lines.join(" ")}`;

/** Each block and the blank line after it; the items of one list stay on consecutive lines. */
const markdownLines = (blocks: readonly Block[]): string[] =>
  blocks.flatMap((block, index) => (block.kind === "item" && blocks[index + 1]?.kind === "item" ? [blockMarkdown(block)] : [blockMarkdown(block), ""]));

export const congressionalRecordToMarkdown = (html: string): string => {
  const pre = /<pre\b[^>]*>([\s\S]*?)<\/pre\s*>/iu.exec(html)?.[1];
  // 本文の <pre> が無いページ（エラーページ・仕様変更）を、指摘ゼロの文書として黙って置かない。
  if (pre === undefined) throw new Error("no <pre>: not a Congressional Record granule from govinfo");
  const text = decodeEntities(pre.replace(/<\/?[a-z][^>]*>/giu, ""));
  const layout = withoutPageMarkers(withoutBanner(text.split(/\r?\n/u))).reduce<Layout>(withLine, { blocks: [], open: undefined });
  return tidyLines(markdownLines(closed(layout)));
};
