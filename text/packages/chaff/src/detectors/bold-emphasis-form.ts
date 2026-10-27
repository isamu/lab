import type { Span } from "../plugin.ts";

/** Quote marks at the head of a line (`> > `), with the indent before them. */
const QUOTE_MARKS = /^[ \t]*(?:>[ \t]*)*/u;

/** The bullet or number that opens a list item. */
const ITEM_MARKER = /^(?:[-*+]|\d{1,9}[.)])[ \t]+/u;

/** A task box after the marker. */
const TASK_BOX = /^\[[ xX]\][ \t]+/u;

/** The end of a sentence, or a colon announcing what follows, past closing quotes, brackets, bold and a hard-break backslash. */
const CLOSED = /[.!?:。！？：]["'”’)\]*_]*\\?$/u;

/** A bold run whose first character, past an opening quote or bracket, is a capital: a name, as a button or a title is. */
const CAPITALISED = /^(?:\*\*|__)["'“‘([]*\p{Lu}/u;

/** How far back a bold looks for the end of the sentence before it. */
const LOOK_BACK = 200;

const lineStartOf = (source: string, offset: number): number => source.lastIndexOf("\n", offset - 1) + 1;

const previousLineOf = (source: string, lineStart: number): string | undefined =>
  lineStart === 0 ? undefined : source.slice(lineStartOf(source, lineStart - 1), lineStart - 1);

/** What stands before a bold on its line, read as quote marks, an item marker and a task box; `rest` is what is left. */
const lineOpeningOf = (opening: string): { readonly item: boolean; readonly rest: string } => {
  const unquoted = opening.replace(QUOTE_MARKS, "");
  const unmarked = unquoted.replace(ITEM_MARKER, "");
  return { item: unmarked !== unquoted, rest: unmarked.replace(TASK_BOX, "") };
};

/** A line opening with bold: in a run of such lines (From:, To:, Date:) each line is a field. */
const opensWithBold = (line: string): boolean => /^(?:\*\*|__)/u.test(line.replace(QUOTE_MARKS, ""));

/** Whether the line before closes a block or a sentence, or is itself a bold field: the line after it starts afresh. */
const followsAClosedLine = (previous: string | undefined): boolean =>
  previous === undefined || previous.trim() === "" || CLOSED.test(previous.trimEnd()) || opensWithBold(previous);

/** A bold that opens its line and its block: a list item's lead, a field (From:), a run-in heading (Pros:), a dateline. */
export const opensItsBlock = (source: string, span: Span): boolean => {
  const lineStart = lineStartOf(source, span.start);
  const opening = lineOpeningOf(source.slice(lineStart, span.start));
  return opening.rest === "" && (opening.item || followsAClosedLine(previousLineOf(source, lineStart)));
};

/** Whether a bold starts a sentence: nothing before it, or the end of a sentence. */
const startsASentence = (before: string): boolean => {
  const trimmed = before.trimEnd();
  return trimmed === "" || CLOSED.test(trimmed);
};

/** A capitalised bold inside a sentence: the name of a button, a setting or a title (click **Add Printer**), not emphasis. */
export const isNameMidSentence = (source: string, span: Span): boolean =>
  CAPITALISED.test(source.slice(span.start, span.end)) && !startsASentence(source.slice(Math.max(0, span.start - LOOK_BACK), span.start));

/** Whether a bold span emphasises words in running text, rather than labelling, heading or naming something. */
export const isEmphasisBold = (source: string, span: Span): boolean => !opensItsBlock(source, span) && !isNameMidSentence(source, span);
