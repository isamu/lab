// A footnote that opens with a citation signal and cites, with nothing of the writer's after the signal: a legal citation
// (See, e.g., 12 C.F.R. §§ 5.34(e)(3) …) or titles of other documents joined by semicolons (See A Title; FDIC: Another Title).
// Its length is the length of the references. Pure.
import { escapeRegExp } from "../orthography.ts";
import { isTitleCase } from "./sentence-title.ts";

/** The section sign marks a citation of a code or a regulation in any language. */
const SECTION_SIGN = /§/u;
/** A citation string cites more than one source (a semicolon between them) or dates what it cites ((Apr. 28, 2005)). */
const CITATION_DETAIL = /;|\([^()]*\d{4}\)/u;
const SEGMENT_SEPARATOR = /;/u;
const MIN_TITLES = 2;
/** "See, e.g.," and "See also, e.g.,": the example signal after the signal. */
const EXAMPLE_SIGNAL = String.raw`(?:,?\s*e\.g\.,)?`;

/** What follows a signal at the very start of the text, or undefined when the text does not open with one. */
const afterOpeningSignal = (text: string, signals: readonly string[]): string | undefined => {
  if (signals.length === 0) return undefined;
  const alternatives = [...signals]
    .sort((left, right) => right.length - left.length)
    .map(escapeRegExp)
    .join("|");
  const opening = new RegExp(String.raw`^(?:${alternatives})${EXAMPLE_SIGNAL}(?![\p{L}\p{N}])`, "iu").exec(text.trim());
  return opening === null ? undefined : text.trim().slice(opening[0].length);
};

const isTitleSeries = (cited: string): boolean => {
  const segments = cited.split(SEGMENT_SEPARATOR).filter((segment) => segment.trim() !== "");
  return segments.length >= MIN_TITLES && segments.every(isTitleCase);
};

/** Whether the text is a citation string: a signal first, then a legal citation or a series of titles. */
export const isCitationString = (text: string, signals: readonly string[]): boolean => {
  const cited = afterOpeningSignal(text, signals);
  return cited !== undefined && ((SECTION_SIGN.test(cited) && CITATION_DETAIL.test(cited)) || isTitleSeries(cited));
};
