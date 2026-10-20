// An acronym the document explains without the "Name (ACR)" form. Pure.

/**
 * "The VIX—a forward-looking measure of near-term stock market volatility—declined": an apposition between dashes right
 * after the acronym says what it is. It opens with an article and closes with a second dash, so a dash that only joins
 * two clauses ("the VIX—it fell") is not one.
 */
const DASH_GLOSS = /(?<![\p{L}\p{N}_&])(?<acronym>[A-Z][A-Z0-9&]{1,9})\s?[—–]\s?(?:an?|the)\s[^—–\n]{3,160}?[—–]/gu;

export const glossedAcronyms = (source: string): ReadonlySet<string> =>
  new Set([...source.matchAll(DASH_GLOSS)].flatMap((match) => match.groups?.["acronym"] ?? []));

/** Two letters are spelled by chance too often ("Data Protection" is not always DP). */
const MIN_SPELLED = 3;

/** Small words a name holds without an initial: "Bureau of Labor Statistics". */
const JOINERS: ReadonlySet<string> = new Set(["of", "and", "the", "for", "on", "in", "to", "&"]);

/**
 * The acronym a heading spells out when the heading is a name and nothing else ("## Federal Open Market Committee" →
 * FOMC): every word but the small ones is capitalised and gives one letter. A heading that holds other words ("Select
 * Open Source Software Licence", "Mission One: Transformed public services") names something else, and gives none.
 */
const spelledBy = (heading: string): string | undefined => {
  const words = heading.split(/\s+/u).filter((word) => word !== "" && !JOINERS.has(word));
  const named = words.length >= MIN_SPELLED && words.every((word) => /^\p{Lu}\p{Ll}*$/u.test(word));
  return named ? words.map((word) => word.charAt(0)).join("") : undefined;
};

/** Whether one of the headings spells out the acronym. The headings are read once, however many acronyms are asked about. */
export const headingsSpellingOut = (headings: readonly string[]): ((acronym: string) => boolean) => {
  const spelled = new Set(headings.flatMap((heading) => spelledBy(heading) ?? []));
  return (acronym) => spelled.has(acronym.replaceAll(/[^A-Z]/gu, ""));
};
