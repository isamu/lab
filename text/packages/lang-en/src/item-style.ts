import type { NumberedLine, NumberingContext } from "chaffjs/plugin";
import { parseRoman } from "./roman.ts";

/**
 * An amendment inserts a subsection between two others and numbers it "(A1)" or "(2A)". It is a subsection, written
 * outside the sequence: it has no ordinal, so "(1)" after "(A1)" is still the first.
 */
export const INSERTED = "\\d{1,3}[A-Z]{1,2}|[A-Z]{1,2}\\d{1,3}";
export const IS_INSERTED = new RegExp(`^(?:${INSERTED})$`, "u");
const MULTI_ROMAN = /^(?:ii|iii|iv|vi|vii|viii|ix)$/u;
const AMBIGUOUS = /^[ivx]$/u;

export type Style = "letter" | "roman" | "digit";

/**
 * 開いている項目の書き方。"(ii)" はローマ数字、"(b)" は英字。一文字の "(i)" はどちらにも読めるので、
 * 開いたときに付けた並びの位置で見分ける。ローマ数字なら 1、英字なら 9。
 */
export const styleOfOpen = (open: NumberedLine): Style | undefined => {
  const inner = /^\((?<n>[A-Za-z0-9]{1,5})\)$/u.exec(open.label)?.groups?.["n"];
  if (inner === undefined) return undefined;
  if (/^\d+$/u.test(inner) || IS_INSERTED.test(inner)) return "digit";
  if (MULTI_ROMAN.test(inner)) return "roman";
  return AMBIGUOUS.test(inner) && open.ordinal === parseRoman(inner) ? "roman" : "letter";
};

const LETTER_BEFORE_A = "a".charCodeAt(0) - 1;

/** "(b)" は 2 番目、"(ii)" も 2 番目。二文字以上の英字（"(aa)"）は並びが決まらないので付けない。 */
export const ordinalOf = (raw: string, style: Style): number | undefined => {
  if (style === "digit") return IS_INSERTED.test(raw) ? undefined : Number(raw);
  if (style === "roman") return parseRoman(raw);
  return raw.length === 1 ? raw.charCodeAt(0) - LETTER_BEFORE_A : undefined;
};

const styles = (context: NumberingContext): (Style | undefined)[] => context.open.map(styleOfOpen);

/** "(h)" の次の "(i)" は英字。開いている英字の次の文字なら、ローマ数字とは読まない。 */
const followsLetter = (raw: string, context: NumberingContext): boolean =>
  context.open.some((open, index) => styles(context)[index] === "letter" && open.number.charCodeAt(0) + 1 === raw.charCodeAt(0));

/**
 * 英字の並びは (a) から始まるので、"(a)" や "(1)" のすぐ下に来た "(i)" は一段深いローマ数字。
 * 米国の規則は (a)(1)(i) の順に下る。見出しのすぐ下の "(i)" は、どちらとも決まらないので英字。
 */
const OPENS_ROMAN: ReadonlySet<Style | undefined> = new Set(["letter", "digit"]);

/** "(i)" is a roman numeral right under "(a)" or "(1)", or when a roman list is already open; the letter i otherwise. */
export const styleOf = (raw: string, context: NumberingContext): Style => {
  if (/^\d+$/u.test(raw) || IS_INSERTED.test(raw)) return "digit";
  if (MULTI_ROMAN.test(raw)) return "roman";
  if (!AMBIGUOUS.test(raw) || followsLetter(raw, context)) return "letter";
  const open = styles(context);
  return open.includes("roman") || OPENS_ROMAN.has(open.at(-1)) ? "roman" : "letter";
};

/**
 * A sibling has the depth of the open item written the same way: "(b)" closes "(i)" and sits beside "(a)".
 * A new way of numbering goes one deeper than whatever is open.
 */
export const depthFor = (style: Style, context: NumberingContext): number => {
  const open = styles(context);
  const sibling = [...context.open].reverse().find((_item, reversed) => open[context.open.length - 1 - reversed] === style);
  return sibling?.depth ?? (context.open.at(-1)?.depth ?? 0) + 1;
};
