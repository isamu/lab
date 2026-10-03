import type { Detector, Finding, ProseDocument } from "../plugin.ts";
import { escapeRegExp } from "../orthography.ts";
import { quoteAround } from "./quote-around.ts";

// 集まりの一部の割合なのに 100% を超える百分率（回答者の120%、150% of respondents）。一部は全体を超えない。
// 集まりの語は語彙表 share-whole、百分率とのあいだの語とその側は share-whole-link、百分率の単位は percent-unit が言う。

export type ShareWords = {
  readonly wholes: readonly string[];
  readonly links: readonly { readonly pattern: string; readonly position: "before" | "after" }[];
  readonly units: readonly string[];
};

/** 100% を超える一部の割合 1 つ。written は百分率、whole は何の一部か。 */
export type ShareOverHundred = { readonly offset: number; readonly end: number; readonly written: string; readonly whole: string };

const WHOLE_PERCENT = 100;
/** 集まりの語が、より長い語の頭でないこと（users_2025、回答者数）。漢字やカタカナが続けば別の語（回答者数は人数で、割合の元ではない）。 */
const NOT_INSIDE_WORD = "(?![A-Za-z0-9_\\p{Script=Han}\\p{Script=Katakana}])";
const FULLWIDTH_OFFSET = 0xfee0;

const halfWidth = (text: string): string => text.replace(/[０-９．]/gu, (char) => String.fromCharCode(char.charCodeAt(0) - FULLWIDTH_OFFSET));

const alternation = (words: readonly string[]): string =>
  words
    .toSorted((left, right) => right.length - left.length)
    .map(escapeRegExp)
    .join("|");

/** 集まりの語の前後の英字だけを語の切れ目に見る。日本語は語を続けて書く（アンケートでは回答者の、120%の回答者が）。 */
const wholeNear = (text: string, start: number, end: number, words: ShareWords): string | undefined => {
  const wholes = alternation(words.wholes);
  return words.links
    .map((link) => {
      const near =
        link.position === "after"
          ? new RegExp(`^\\s*${escapeRegExp(link.pattern)}\\s*(?<whole>${wholes})${NOT_INSIDE_WORD}`, "u").exec(text.slice(end))
          : new RegExp(`(?<![A-Za-z])(?<whole>${wholes})${escapeRegExp(link.pattern)}\\s*$`, "u").exec(text.slice(0, start));
      return near?.groups?.["whole"];
    })
    .find((whole) => whole !== undefined);
};

/** 文字列の中の、集まりの一部の割合なのに 100% を超える百分率。 */
export const sharesOverHundred = (text: string, words: ShareWords): ShareOverHundred[] => {
  if (words.wholes.length === 0 || words.units.length === 0) return [];
  const percent = new RegExp(`(?<![\\d.,，０-９])(?<value>[0-9０-９]+(?:[,，][0-9０-９]{3})*(?:[.．][0-9０-９]+)?)\\s?(?:${alternation(words.units)})`, "gu");
  return [...text.matchAll(percent)].flatMap((match) => {
    const value = Number(halfWidth(match.groups?.["value"] ?? "").replace(/[,，]/gu, ""));
    if (value <= WHOLE_PERCENT) return [];
    const end = match.index + match[0].length;
    const whole = wholeNear(text, match.index, end, words);
    return whole === undefined ? [] : [{ offset: match.index, end, written: match[0], whole }];
  });
};

const positioned = (doc: ProseDocument): ShareWords["links"] =>
  (doc.lexicons["share-whole-link"] ?? []).flatMap((entry) => (entry.position === undefined ? [] : [{ pattern: entry.pattern, position: entry.position }]));

export const shareOverHundred: Detector = (doc): Finding[] => {
  const text = doc.prose ?? doc.source;
  const words: ShareWords = {
    wholes: (doc.lexicons["share-whole"] ?? []).map((entry) => entry.pattern),
    links: positioned(doc),
    units: (doc.lexicons["percent-unit"] ?? []).map((entry) => entry.pattern),
  };
  return sharesOverHundred(text, words).map((found) => ({
    rule: "",
    severity: "warning",
    line: 0,
    column: 0,
    quote: quoteAround(text, found.offset, found.end),
    values: { written: found.written, whole: found.whole, offset: found.offset },
  }));
};
