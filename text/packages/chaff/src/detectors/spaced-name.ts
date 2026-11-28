// Capitals written apart from the word they belong to, in a name the same document also writes as one word: JS Conf beside
// JSConf. The capitals are the head of that name, not an acronym of their own, so undefined-acronym does not count them. Pure.

type Span = { readonly start: number; readonly end: number };

/** Capitals, one space, then a capitalised word. */
const SPACED = /(?<![\p{L}\p{N}_&])(?<capitals>[A-Z]{2,6}) (?<word>\p{Lu}\p{Ll}+)(?![\p{L}\p{N}_&])/gu;

const joinedIn = (source: string, joined: string): boolean => new RegExp(`(?<![\\p{L}\\p{N}_&])${joined}(?![\\p{L}\\p{N}_&])`, "u").test(source);

/** The spans of the capitals of each spaced name whose joined form the source also holds. */
export const spacedNameSpans = (source: string): Span[] =>
  [...source.matchAll(SPACED)].flatMap((match) => {
    const capitals = match.groups?.["capitals"] ?? "";
    const word = match.groups?.["word"] ?? "";
    return joinedIn(source, `${capitals}${word}`) ? [{ start: match.index, end: match.index + capitals.length }] : [];
  });
