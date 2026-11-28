// A label printed on a form or a screen, quoted as it is printed and named by the control it marks: the “VOID” box, the
// "SUBMIT" button, 「OK」ボタン. The capitals are the form's words, which the writer cannot change, so undefined-acronym counts
// them but does not ask to spell them out. Pure: the control nouns come from the language's lexicon control-noun.
import { oneOf } from "./acronym-name.ts";

type Span = { readonly start: number; readonly end: number };

const OPENING_QUOTES = `"“‘'「『`;
const CLOSING_QUOTES = `"”’'」』`;

/** The quoted capitals, right before a control noun; the quote marks may be followed by one space. */
const labelPattern = (nouns: readonly string[]): RegExp =>
  new RegExp(String.raw`[${OPENING_QUOTES}](?<label>[A-Z][A-Z0-9]{1,15})[${CLOSING_QUOTES}][ \t]?${oneOf(nouns)}(?![\p{Ll}])`, "gu");

/** The spans of the quoted labels in the source, each the label without its quote marks. nouns: the control nouns. */
export const quotedLabelSpans = (source: string, nouns: readonly string[]): Span[] => {
  if (nouns.length === 0) return [];
  return [...source.matchAll(labelPattern(nouns))].map((match) => {
    const start = match.index + 1;
    return { start, end: start + (match.groups?.["label"]?.length ?? 0) };
  });
};
