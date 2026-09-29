// What the wikitext and HTML converters share: character references turned back into characters, and the blank
// lines and trailing spaces a converter leaves behind tidied away. Pure.
import { characterEntities } from "character-entities";

// A named space (&nbsp;, &thinsp;) is read as a plain space, like the spacing between the page's other words.
const isSpace = (value: string): boolean => /^\p{Zs}+$/u.test(value);

/** A name of the HTML standard, matched as written: "&Oslash;" is Ø and "&oslash;" is ø. */
const decodeName = (name: string, whole: string): string => {
  const value = Object.hasOwn(characterEntities, name) ? characterEntities[name] : undefined;
  if (value === undefined) return whole;
  return isSpace(value) ? " " : value;
};

const fromCodePoint = (code: number, whole: string): string => (Number.isInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole);

const decodeOne = (whole: string, name: string): string => {
  if (name.startsWith("#x") || name.startsWith("#X")) return fromCodePoint(Number.parseInt(name.slice(2), 16), whole);
  if (name.startsWith("#")) return fromCodePoint(Number.parseInt(name.slice(1), 10), whole);
  return decodeName(name, whole);
};

/** In one pass, so "&amp;lt;" is "&lt;" and not "<". An unknown name is left as written. */
export const decodeEntities = (text: string): string =>
  text.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/giu, (whole: string, name: string) => decodeOne(whole, name));

/** Trailing spaces removed, runs of blank lines made one, and a single newline at the end. */
export const tidyLines = (lines: readonly string[]): string => {
  const text = lines
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
  return text === "" ? "" : `${text}\n`;
};
