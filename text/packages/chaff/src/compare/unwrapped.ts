import { softBreaks, withoutSpans } from "../soft-break.ts";

/** A line break between two wide characters (「系の\nシステム」) vanishes when the text is rendered. */
const withoutSoftBreaks = (text: string): string => withoutSpans(text, softBreaks(text));

/** The text on one line as a reader sees it: vanishing line breaks removed, any other run of white space one space. */
export const unwrappedText = (text: string): string => withoutSoftBreaks(text).replace(/\s+/gu, " ");

/** A fact's text as one spelling: unwrapped, and full-width and half-width forms alike. */
export const unwrappedKey = (text: string): string => withoutSoftBreaks(text).normalize("NFKC").replace(/\s+/gu, " ");
