// What the wikitext and HTML converters share: character references turned back into characters, and the blank
// lines and trailing spaces a converter leaves behind tidied away. Pure.

const NAMED: Readonly<Record<string, string>> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  mdash: "—",
  ndash: "–",
  hellip: "…",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  sect: "§",
  copy: "©",
  reg: "®",
  trade: "™",
  deg: "°",
  middot: "·",
  bull: "•",
  times: "×",
  minus: "−",
  larr: "←",
  uarr: "↑",
  rarr: "→",
  darr: "↓",
};

const fromCodePoint = (code: number, whole: string): string => (Number.isInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole);

const decodeOne = (whole: string, name: string): string => {
  if (name.startsWith("#x") || name.startsWith("#X")) return fromCodePoint(Number.parseInt(name.slice(2), 16), whole);
  if (name.startsWith("#")) return fromCodePoint(Number.parseInt(name.slice(1), 10), whole);
  return NAMED[name.toLowerCase()] ?? whole;
};

/** In one pass, so "&amp;lt;" is "&lt;" and not "<". An unknown name is left as written. */
export const decodeEntities = (text: string): string => text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/giu, (whole: string, name: string) => decodeOne(whole, name));

/** Trailing spaces removed, runs of blank lines made one, and a single newline at the end. */
export const tidyLines = (lines: readonly string[]): string => {
  const text = lines
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
  return text === "" ? "" : `${text}\n`;
};
