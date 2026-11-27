// The letters a sentence says an identifier starts with (a number that starts with XI, XIで始まる番号). They are the code
// printed at the head of the identifier, typed as they are, which the writer cannot change, so undefined-acronym counts them
// but does not ask to spell them out. Pure: the phrases come from the language's lexicon code-prefix-phrase, each with {code}
// where the letters stand.
import { escapeRegExp } from "../orthography.ts";

type Span = { readonly start: number; readonly end: number };

const SLOT = "{code}";
/** A prefix is a few capitals, in quotes or not, not joined to other Latin letters or digits (Japanese may follow: XIで始まる). */
const CODE = String.raw`["“'‘]?(?<![A-Za-z0-9])(?<code>[A-Z]{1,4})(?![A-Za-z0-9])["”'’]?`;

/** The phrase may open a sentence (Starts with), so its first letter is matched in either case; the code stays capitals. */
const eitherCase = (pattern: string): string => {
  const first = pattern.charAt(0);
  return first.toLowerCase() === first.toUpperCase() ? pattern : `[${first.toLowerCase()}${first.toUpperCase()}]${pattern.slice(1)}`;
};

const SPACES = String.raw`\s+`;
const words = (part: string): string => part.split(/\s+/u).filter(Boolean).map(escapeRegExp).join(SPACES);

/** One phrase as a pattern: the words before and after the slot, joined by any run of spaces. */
const phrasePattern = (phrase: string): string | undefined => {
  const at = phrase.indexOf(SLOT);
  if (at === -1) return undefined;
  const [before, after] = [words(phrase.slice(0, at)), words(phrase.slice(at + SLOT.length))];
  const lead = before === "" ? "" : String.raw`(?<![A-Za-z0-9])${eitherCase(before)}\s+`;
  const tail = after === "" ? "" : String.raw`\s*${after}`;
  return `${lead}${CODE}${tail}`;
};

/** The spans of the prefix letters in the source. phrases: the lexicon's patterns, such as "starts with {code}". */
export const codePrefixSpans = (source: string, phrases: readonly string[]): Span[] =>
  phrases
    .flatMap((phrase) => phrasePattern(phrase) ?? [])
    .flatMap((pattern) =>
      [...source.matchAll(new RegExp(pattern, "gu"))].map((match) => {
        const code = match.groups?.["code"] ?? "";
        const start = match.index + match[0].indexOf(code);
        return { start, end: start + code.length };
      }),
    );
