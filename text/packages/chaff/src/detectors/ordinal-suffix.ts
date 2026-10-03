import type { Detector, Finding, Lexicon } from "../plugin.ts";
import { escapeRegExp } from "../orthography.ts";
import { quoteAround } from "./quote-around.ts";

// 数と序数の字が合わない所（3th、22th、11st）。どの数の終わりにどの字が付くかは語彙表 ordinal-suffix が言う。

/** 合わない序数 1 つ。expected はその数に付く字（一つとは限らない）。 */
export type OrdinalSlip = { readonly offset: number; readonly written: string; readonly number: string; readonly expected: readonly string[] };

/** 数の終わりのうち、語彙表の組にある最も長いものに付く字。 */
const suffixesFor = (digits: string, suffixes: Lexicon): string[] => {
  const ending = suffixes
    .map((entry) => entry.group ?? "")
    .filter((group) => digits.endsWith(group))
    .reduce((longest, group) => (group.length > longest.length ? group : longest), "");
  return suffixes.filter((entry) => (entry.group ?? "") === ending).map((entry) => entry.pattern);
};

/** 文字列の中の、数と字の合わない序数。語や番号の一部（v1th、0x2nd、1-2th）は読まない。 */
export const ordinalSlips = (text: string, suffixes: Lexicon): OrdinalSlip[] => {
  const written = [...new Set(suffixes.map((entry) => entry.pattern))];
  if (written.length === 0) return [];
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}_.,\\-])(?<n>\\d+(?:,\\d{3})*)(?<suffix>${written.map(escapeRegExp).join("|")})(?![\\p{L}\\p{N}_])`, "gu");
  return [...text.matchAll(pattern)].flatMap((match) => {
    const expected = suffixesFor((match.groups?.["n"] ?? "").replaceAll(",", ""), suffixes);
    return expected.includes(match.groups?.["suffix"] ?? "") ? [] : [{ offset: match.index, written: match[0], number: match.groups?.["n"] ?? "", expected }];
  });
};

export const ordinalSuffix: Detector = (doc): Finding[] => {
  const text = doc.prose ?? doc.source;
  return ordinalSlips(text, doc.lexicons["ordinal-suffix"] ?? []).map((slip) => ({
    rule: "",
    severity: "warning",
    line: 0,
    column: 0,
    quote: quoteAround(text, slip.offset, slip.offset + slip.written.length),
    values: { written: slip.written, expected: `${slip.number}${slip.expected[0] ?? ""}`, offset: slip.offset },
  }));
};
