// Fenced code blocks (``` or ~~~) and inline code spans of a Markdown source. Pure. A fence's language is the first word
// of its info string (```bash, ```{r}); a fence inside a blockquote is someone else's and is not read.
import { parse } from "../markdown-read.ts";
import { spanOf } from "../markdown-node.ts";
import { eachPreOrder } from "../tree-walk.ts";

export type CodeFence = {
  /** Where the opening fence line starts. */
  readonly start: number;
  /** The first word of the info string, lower-cased; "" when the fence names none. */
  readonly language: string;
  /** The lines between the fences. */
  readonly lines: readonly string[];
  /** Where the block ends: the end of the closing fence line, or of the document. */
  readonly end: number;
};

export type CodeSpan = { readonly start: number; readonly text: string };

const MIN_FENCE = 3;

type Opening = { readonly mark: string; readonly length: number };

/** The fence a code block's first line opens, with its info string; undefined for an indented block, which has none. */
export const fenceOf = (line: string): { readonly fence: Opening; readonly info: string } | undefined => {
  const mark = line.charAt(0);
  if (mark !== "`" && mark !== "~") return undefined;
  const length = [...line].findIndex((char) => char !== mark);
  const run = length === -1 ? line.length : length;
  if (run < MIN_FENCE) return undefined;
  const info = line.slice(run).trim();
  // A backtick fence's info string has no backtick: ```js``` on one line is an inline span.
  return mark === "`" && info.includes("`") ? undefined : { fence: { mark, length: run }, info };
};

/** The language an info string names: its first word, without braces or a leading dot ({r}, {.python}). */
export const languageOf = (info: string): string => {
  const word = info.split(/\s/u)[0] ?? "";
  const opened = word.startsWith("{") ? word.slice(1) : word;
  const bare = opened.startsWith(".") ? opened.slice(1) : opened;
  const cut = [...bare].findIndex((char) => char === "{" || char === "}" || char === ",");
  return (cut === -1 ? bare : bare.slice(0, cut)).toLowerCase();
};

/** How many backticks run from `at`. */
const runAt = (text: string, at: number): number => {
  const state = { end: at };
  while (text.charAt(state.end) === "`") state.end += 1;
  return state.end - at;
};

/** The fences of the last source read: the three rules that read fences parse a document once. */
const lastRead: { source: string | undefined; fences: readonly CodeFence[] } = { source: undefined, fences: [] };

const isQuoted = (source: string, offset: number): boolean =>
  source
    .slice(source.lastIndexOf("\n", offset - 1) + 1, offset)
    .trimStart()
    .startsWith(">");

/**
 * Every fenced code block, in order, as the Markdown parser reads it: a fence in a list item is one, an indented code
 * block (four spaces, no fence) is not, and an unclosed fence runs to the end. A fence inside a quotation is left out.
 */
export const codeFences = (source: string): readonly CodeFence[] => {
  if (lastRead.source === source) return lastRead.fences;
  const fences: CodeFence[] = [];
  eachPreOrder(parse(source), (node) => {
    const span = node.type === "code" ? spanOf(node) : undefined;
    if (span === undefined || isQuoted(source, span.start)) return;
    const lineEnd = source.indexOf("\n", span.start);
    // A fenced block starts at its fence; an indented block starts at its indentation, which is no fence.
    const opening = fenceOf(source.slice(span.start, lineEnd === -1 ? source.length : lineEnd).trimEnd());
    if (opening === undefined) return;
    fences.push({ start: span.start, language: languageOf(opening.info), lines: (node.value ?? "").split("\n"), end: span.end });
  });
  lastRead.source = source;
  lastRead.fences = fences;
  return fences;
};

/** Inline code spans in a stretch of text: a run of backticks closed by a run of the same length. */
export const codeSpans = (text: string, offset = 0): CodeSpan[] => {
  const spans: CodeSpan[] = [];
  const state = { at: 0 };
  while (state.at < text.length) {
    const open = text.indexOf("`", state.at);
    if (open === -1) break;
    const length = runAt(text, open);
    const fence = "`".repeat(length);
    const close = findRun(text, fence, open + length);
    if (close === -1) {
      state.at = open + length;
    } else {
      spans.push({ start: offset + open, text: text.slice(open + length, close).trim() });
      state.at = close + length;
    }
  }
  return spans;
};

/** The next run of exactly this many backticks from `from`, or -1. */
const findRun = (text: string, run: string, from: number): number => {
  const state = { at: from };
  while (state.at < text.length) {
    const found = text.indexOf(run, state.at);
    if (found === -1) return -1;
    if (text.charAt(found + run.length) !== "`" && text.charAt(found - 1) !== "`") return found;
    state.at = found + run.length;
    while (text.charAt(state.at) === "`") state.at += 1;
  }
  return -1;
};
