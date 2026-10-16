// A title written on a line of its own, as a plain-text heading (Exhibit A to Merger Agreement, ANNEX 1): a few words with
// no full stop, and a blank line or the document's edge on both sides. Pure.

/**
 * How a reader tells a title from a sentence. dangling-figure-reference reads a caption of any labelled thing; duplicate-
 * definition reads where an attached instrument starts. Their notions differ, so each says how.
 */
export type TitleNotion = {
  /** A title ending in one of these is a sentence or runs on. duplicate-definition also refuses a trailing `: ; ,`. */
  readonly sentenceEnd: RegExp;
  /** Every word longer than three letters starts with a capital. dangling-figure-reference only: Figure 3 shows the trend. */
  readonly capitalised: boolean;
  /**
   * "any-whitespace": the document's edge may be reached across any whitespace (a line of U+3000 or NBSP before the
   * first line). "blank-line": only lines of spaces and tabs count. dangling-figure-reference takes the first.
   */
  readonly edge: "any-whitespace" | "blank-line";
};

/** A title runs at most this many words after its label and number. */
const TITLE_MAX_WORDS = 6;
/** A word this long or shorter may stay in lower case in a title (to, of, the, and). */
const TITLE_SMALL_WORD = 3;
const BLANK_LINE = /\n[ \t\r]*\n[ \t\r]*$/u;
const ENDS_LINE = /^[ \t\r]*\n/u;
const BLANK = /^[ \t\r]*$/u;
const LOWER_START = /^\p{Ll}/u;

const isShortTitle = (rest: string, notion: TitleNotion): boolean => {
  const title = rest.trim();
  const words = title.split(/\s+/u).filter((word) => word !== "");
  return (
    words.length <= TITLE_MAX_WORDS &&
    !notion.sentenceEnd.test(title) &&
    (!notion.capitalised || words.every((word) => word.length <= TITLE_SMALL_WORD || !LOWER_START.test(word)))
  );
};

const isAloneBefore = (before: string, notion: TitleNotion): boolean =>
  before === "" || BLANK_LINE.test(`\n${before}`) || (notion.edge === "any-whitespace" && before.trim() === "");

const isAloneAfter = (after: string, isLastLine: boolean, notion: TitleNotion): boolean =>
  isLastLine || ENDS_LINE.test(after) || BLANK.test(after) || (notion.edge === "any-whitespace" && after.trim() === "");

/**
 * The line from lineStart to lineEnd (-1: the last line) is a title: rest, the words after its label and number, are a
 * short title, and a blank line or the document's edge is on both sides.
 */
export const isTitleLine = (source: string, lineStart: number, lineEnd: number, rest: string, notion: TitleNotion): boolean =>
  isShortTitle(rest, notion) &&
  isAloneBefore(source.slice(0, lineStart), notion) &&
  isAloneAfter(lineEnd === -1 ? "" : source.slice(lineEnd + 1), lineEnd === -1, notion);
