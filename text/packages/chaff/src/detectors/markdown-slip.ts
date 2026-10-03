// Markdown that does not render the way it was written: a table row with more cells than its header (GFM drops the
// extra ones), a code fence that is never closed (the rest of the document becomes code), and strong-emphasis marks
// (`**`) that Markdown cannot pair and shows as they are. Pure; reads the source's Markdown tree.
import type { Detector, Finding, ProseDocument, Span } from "../plugin.ts";
import { readMarkdown } from "../markdown-read.ts";
import { spanOf, type MarkdownNode } from "../markdown-node.ts";
import { findingAt, markupOf } from "./markup-finding.ts";

/** Quotations are someone else's text, and their markup is theirs. */
const QUOTED = "blockquote";

/** Nodes of one type outside quotations, in source order. Walks with its own stack: Markdown nests without limit. */
const nodesOf = (root: MarkdownNode, type: string): MarkdownNode[] => {
  const found: MarkdownNode[] = [];
  const pending: MarkdownNode[] = [root];
  for (let node = pending.pop(); node !== undefined; node = pending.pop()) {
    if (node.type === QUOTED) continue;
    if (node.type === type) found.push(node);
    (node.children ?? []).toReversed().forEach((child) => pending.push(child));
  }
  return found;
};

const markdownRoot = (doc: ProseDocument): MarkdownNode | undefined => (markupOf(doc) === undefined ? undefined : readMarkdown(doc.source).root);

/** An HTML comment: a cell holding only one shows the reader nothing, and losing it loses nothing. */
const COMMENT = /<!--[\s\S]*?-->/gu;

/** Whether a cell shows the reader anything: its source without the bars, comments and spaces. */
const cellShows = (source: string, cell: MarkdownNode): boolean => {
  const span = spanOf(cell);
  return span !== undefined && source.slice(span.start, span.end).replaceAll("|", "").replace(COMMENT, "").trim() !== "";
};

/**
 * A body row with more cells than the header: GFM shows only as many cells as the header has, and drops the rest. Extra cells
 * that are empty or hold only a comment lose nothing and are not reported.
 */
export const tableRowOverflow: Detector = (doc): Finding[] => {
  const root = markdownRoot(doc);
  if (root === undefined) return [];
  return nodesOf(root, "table").flatMap((table) => {
    const [header, ...body] = table.children ?? [];
    const columns = header?.children?.length ?? 0;
    return body.flatMap((row) => {
      const cells = row.children ?? [];
      const span = spanOf(row);
      const lost = cells.slice(columns).some((cell) => cellShows(doc.source, cell));
      return lost && span !== undefined ? [findingAt(doc, span, { cells: cells.length, columns })] : [];
    });
  });
};

/** A fence opening a code block: three or more backticks or tildes, after up to three spaces. */
const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})/u;

/** A closing fence may sit at most this many columns further in than the container's text; four in, it is code. */
const MAX_FENCE_INDENT = 3;

const TAB_WIDTH = 4;

const indentOf = (line: string): number =>
  [...line.slice(0, line.length - line.trimStart().length)].reduce((width, char) => width + (char === "\t" ? TAB_WIDTH : 1), 0);

/** Whether a line closes a fence: not indented past the limit, the same character, at least as many, and nothing after but spaces. */
const closes = (line: string, fence: string, maxIndent: number): boolean => {
  const trimmed = line.trim();
  const mark = fence.charAt(0);
  return indentOf(line) <= maxIndent && trimmed.length >= fence.length && [...trimmed].every((char) => char === mark);
};

/** The opening fence of a code block that is never closed; undefined for a closed or an indented block. */
const unclosedFenceOf = (source: string, span: Span): Span | undefined => {
  const lines = source.slice(span.start, span.end).split("\n");
  const first = lines[0] ?? "";
  const fence = FENCE_OPEN.exec(first)?.[1];
  if (fence === undefined) return undefined;
  const column = span.start - (source.lastIndexOf("\n", span.start - 1) + 1);
  const last = lines.length > 1 ? (lines.at(-1) ?? "") : "";
  return closes(last, fence, column + MAX_FENCE_INDENT) ? undefined : { start: span.start, end: span.start + first.trimEnd().length };
};

/**
 * A fenced code block with no closing fence. Markdown runs it to the end of the document (or of the list item it is in), so
 * everything after the opening fence shows as code. Reported at the opening fence.
 */
export const unclosedCodeFence: Detector = (doc): Finding[] => {
  const root = markdownRoot(doc);
  if (root === undefined) return [];
  return nodesOf(root, "code").flatMap((code) => {
    const span = spanOf(code);
    const open = span === undefined ? undefined : unclosedFenceOf(doc.source, span);
    return open === undefined ? [] : [findingAt(doc, open, { fence: doc.source.slice(open.start, open.end).trim() })];
  });
};

/** `**` or `__` left in text: Markdown would have made it strong emphasis if it could pair it. Longer runs are rules or blanks to fill. */
const STRONG_RUN = /(?<![*_])(?:\*\*|__)(?![*_])/gu;

/** A run with Latin letters or digits on both sides (`2**10`, `snake__case`) is part of the word. Japanese has no spaces, so 「は**金」 is a mark. */
const WORD_CHAR = /[A-Za-z0-9]/u;

const isSpace = (char: string): boolean => char === "" || /\s/u.test(char);

/** Python's dunder names (`__init__`) written outside code. */
const DUNDER = /__\w+__/u;

const dunderAround = (text: string, run: Span): boolean => {
  const start = text.lastIndexOf(" ", run.start) + 1;
  const end = text.indexOf(" ", run.end);
  return DUNDER.test(text.slice(start, end === -1 ? text.length : end));
};

/** The strong-emphasis runs in one text node that Markdown left as text. */
export const strayStrongRuns = (text: string): Span[] =>
  [...text.matchAll(STRONG_RUN)].flatMap((match) => {
    const run = { start: match.index, end: match.index + match[0].length };
    const before = text.charAt(run.start - 1);
    const after = text.charAt(run.end);
    if (before === "\\" || (WORD_CHAR.test(before) && WORD_CHAR.test(after))) return [];
    if (isSpace(before) && isSpace(after)) return [];
    return dunderAround(text, run) ? [] : [run];
  });

/**
 * `**` or `__` that Markdown shows as it is: strong emphasis left open (`**bold`), or one CommonMark cannot close because a
 * bracket or a quotation mark touches the mark from inside while a letter touches it from outside (`**「重要」**です`).
 */
export const unrenderedEmphasis: Detector = (doc): Finding[] => {
  const root = markdownRoot(doc);
  if (root === undefined) return [];
  return nodesOf(root, "text").flatMap((node) => {
    const span = spanOf(node);
    if (span === undefined) return [];
    const written = doc.source.slice(span.start, span.end);
    return strayStrongRuns(written).map((run) =>
      findingAt(doc, { start: span.start + run.start, end: span.start + run.end }, { mark: written.slice(run.start, run.end) }),
    );
  });
};
