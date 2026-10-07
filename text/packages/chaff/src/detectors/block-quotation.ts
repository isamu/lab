// A block quotation (`> …`) that a dash line gives to someone: `— Name` as the last line of its last paragraph, or as
// the paragraph right after it. A block quotation with no such line is not given to anyone, and a GitHub alert
// (`> [!NOTE]`) is the writer's own text. Only the quotation's own paragraphs are its words: code in it is not, and a
// quotation inside it is read on its own. Pure; reads the Markdown tree.
import { spanOf, type MarkdownNode } from "../markdown-node.ts";
import { lineStarts } from "../position.ts";

/** quote: the quotation's words without the `>` marks. passage: the quotation and its dash line as written, where a source would be. */
export type BlockQuotation = { readonly offset: number; readonly quote: string; readonly passage: string };

/**
 * An em dash, a horizontal bar or an en dash, once or twice, then a name: not a lower-case word, which goes on a sentence
 * (— and then it slipped). A single `-` opens a list item, and `--` opens an email signature.
 */
const DASH_LINE = /^[—―–]{1,2}[\t\p{Zs}]*(?!\p{Ll})\p{L}/u;
/** Longer than this, a line opening with a dash is a sentence, not a name and a work. */
const MAX_ATTRIBUTION_CHARS = 120;
const QUOTE_MARKS = /^(?:[ \t]*>[ \t]?)+/u;
const ALERT = /^\[![A-Za-z]+\]/u;
/** Japanese and Chinese text runs on across a line break; anything else is separated by a space. */
const CJK = String.raw`[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}、。「」『』（）！？：；]`;
const CJK_END = new RegExp(`${CJK}$`, "u");
const CJK_START = new RegExp(`^${CJK}`, "u");

type Line = { readonly offset: number; readonly text: string };

const isDashLine = (text: string): boolean => DASH_LINE.test(text) && [...text].length <= MAX_ATTRIBUTION_CHARS;

/** Each non-blank line of a node without its `>` marks, at the place in source where its words start. */
const linesOf = (source: string, node: MarkdownNode): Line[] => {
  const span = spanOf(node);
  if (span === undefined) return [];
  const text = source.slice(span.start, span.end);
  const starts = lineStarts(text);
  return text.split("\n").flatMap((raw, index) => {
    const marks = QUOTE_MARKS.exec(raw)?.[0].length ?? 0;
    const words = raw.slice(marks);
    const indent = words.length - words.trimStart().length;
    return words.trim() === "" ? [] : [{ offset: span.start + (starts[index] ?? 0) + marks + indent, text: words.trim() }];
  });
};

/** What goes between two lines: nothing where Japanese or Chinese runs on, a space otherwise. */
const separator = (before: string, after: string): string => (before === "" || CJK_END.test(before) || CJK_START.test(after) ? "" : " ");

/** Lines joined as the reader reads them. */
const joined = (lines: readonly Line[]): string => lines.map((line) => line.text).reduce((text, next) => `${text}${separator(text, next)}${next}`, "");

/** The dash line of a paragraph that is only that line. */
const dashParagraph = (source: string, node: MarkdownNode | undefined): string | undefined => {
  const lines = node?.type === "paragraph" ? linesOf(source, node) : [];
  const only = lines.length === 1 ? lines[0]?.text : undefined;
  return only !== undefined && isDashLine(only) ? only : undefined;
};

const quotationOf = (source: string, quote: MarkdownNode, next: MarkdownNode | undefined): BlockQuotation | undefined => {
  const children = quote.children ?? [];
  const lines = children.filter((child) => child.type === "paragraph").flatMap((paragraph) => linesOf(source, paragraph));
  const last = children.at(-1)?.type === "paragraph" ? lines.at(-1) : undefined;
  if (ALERT.test(lines[0]?.text ?? "")) return undefined;
  const inside = last !== undefined && isDashLine(last.text);
  const attribution = inside ? last.text : dashParagraph(source, next);
  const body = inside ? lines.slice(0, -1) : lines;
  const first = body[0];
  const span = spanOf(quote);
  if (attribution === undefined || first === undefined || span === undefined) return undefined;
  return { offset: first.offset, quote: joined(body), passage: `${source.slice(span.start, span.end)}\n${attribution}` };
};

/**
 * Every block quotation given to someone by a dash line. One that is not given to anyone is read for a quotation inside
 * it. Walks with its own stack: Markdown nests without limit.
 */
export const blockQuotations = (root: MarkdownNode, source: string): BlockQuotation[] => {
  const found: BlockQuotation[] = [];
  const pending: MarkdownNode[] = [root];
  for (let node = pending.pop(); node !== undefined; node = pending.pop()) {
    const children = node.children ?? [];
    const given = children.map((child, index) => (child.type === "blockquote" ? quotationOf(source, child, children[index + 1]) : undefined));
    given.forEach((quotation) => {
      if (quotation !== undefined) found.push(quotation);
    });
    children
      .filter((_child, index) => given[index] === undefined)
      .toReversed()
      .forEach((child) => pending.push(child));
  }
  return found.toSorted((left, right) => left.offset - right.offset);
};
