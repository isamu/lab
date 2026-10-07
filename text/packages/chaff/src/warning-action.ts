// A warning (Warning:, 注意：, > [!WARNING]) that names a risk and gives the reader nothing to do. Pure: reads a paragraph's
// text and its sentences; the labels and the words of an action come from the language's warning-label and warning-action
// lexicons.
import { escapeRegExp } from "./orthography.ts";

export type WarningWords = {
  /** What a warning opens with: Warning, Caution, 注意, 警告. */
  readonly labels: readonly string[];
  /**
   * What makes a sentence an action. A Latin entry is matched as whole words anywhere (do not, make sure, must); another is
   * matched at the end of the sentence (ください, ましょう), where Japanese puts what the reader is to do.
   */
  readonly actions: readonly string[];
};

/** What may come before the label: a quote mark, bold, a GitHub alert's [! (> [!WARNING], **Warning:**). */
const BEFORE_LABEL = /^(?:>[ \t]*)*(?:\*\*|__)?(?:\[!)?/u;
/** What closes the label: the end of bold or of an alert, then a colon or an exclamation mark, or the end of the line. */
const LABEL_CLOSE = /^(?:\*\*|__)?\]?[ \t]*/u;
const LABEL_MARK = /^[:：!！](?:\*\*|__)?[ \t]*/u;
const SENTENCE_END_MARKS = new Set([..." \t\r\n。．.!！?？」』)）"]);
const LATIN_START = /^[A-Za-z]/u;
const LETTER = /\p{L}/u;

/**
 * Where the text after a paragraph's warning label starts, or undefined when the paragraph opens with no label. The label
 * must stand alone: "Warning:", "注意：", "**Caution**", "> [!WARNING]", not "Warnings are logged" or 「注意深く」.
 */
export const warningTextStart = (paragraph: string, labels: readonly string[]): number | undefined => {
  const lead = BEFORE_LABEL.exec(paragraph)?.[0].length ?? 0;
  const rest = paragraph.slice(lead);
  const label = labels.find((word) => rest.toLowerCase().startsWith(word.toLowerCase()));
  if (label === undefined) return undefined;
  const after = rest.slice(label.length);
  const close = LABEL_CLOSE.exec(after)?.[0].length ?? 0;
  const mark = LABEL_MARK.exec(after.slice(close))?.[0].length;
  if (mark !== undefined) return lead + label.length + close + mark;
  const next = after.slice(close);
  return next === "" || next.startsWith("\n") || next.startsWith("\r\n") ? lead + label.length + close : undefined;
};

const SPACES = /\s+/gu;

/** A word or phrase as whole words, with any run of spaces or a line break between its words ("Do\nnot"). */
const hasWholeWord = (text: string, word: string): boolean => {
  const lowered = text.replaceAll(SPACES, " ").toLowerCase();
  const target = word.toLowerCase();
  return [...lowered.matchAll(new RegExp(escapeRegExp(target), "gu"))].some(
    (match) => !LETTER.test(lowered[match.index - 1] ?? "") && !LETTER.test(lowered[match.index + target.length] ?? ""),
  );
};

/** Whether a sentence tells the reader what to do, by the words of the warning-action lexicon. */
export const namesAction = (sentence: string, actions: readonly string[]): boolean => {
  const chars = [...sentence];
  const ending = chars.slice(0, chars.findLastIndex((char) => !SENTENCE_END_MARKS.has(char)) + 1).join("");
  return actions.some((word) => (LATIN_START.test(word) ? hasWholeWord(sentence, word) : ending.endsWith(word)));
};

const QUOTED = /^[ \t]*>/u;

/**
 * Where the block quote holding an offset ends, or undefined when its line is not quoted. A GitHub alert (> [!WARNING])
 * runs over every quoted line after it, blank quoted lines (>) included, so its action may be in a later paragraph.
 */
export const quoteBlockEnd = (source: string, offset: number): number | undefined => {
  const lineStart = source.lastIndexOf("\n", offset - 1) + 1;
  const lines = source.slice(lineStart).split("\n");
  const quoted = lines.findIndex((line) => !QUOTED.test(line));
  const count = quoted < 0 ? lines.length : quoted;
  if (count === 0) return undefined;
  return lineStart + lines.slice(0, count).join("\n").length;
};
