import type { NumberedLine, NumberingContext } from "chaffjs/plugin";
import { parseRoman } from "./roman.ts";

/**
 * An amendment inserts a subsection between two others and numbers it "(A1)" or "(2A)". It is a subsection, written
 * outside the sequence: it has no ordinal, so "(1)" after "(A1)" is still the first.
 */
export const INSERTED = "\\d{1,3}[A-Z]{1,2}|[A-Z]{1,2}\\d{1,3}";
const IS_INSERTED = new RegExp(`^(?:${INSERTED})$`, "u");
const MULTI_ROMAN = /^(?:ii|iii|iv|vi|vii|viii|ix)$/u;
const AMBIGUOUS = /^[ivx]$/u;
const DIGITS = /^\d+$/u;
const CAPITALS = /^[A-Z]+$/u;
const ONE_CAPITAL = /^[A-Z]$/u;

export type Style = "letter" | "roman" | "digit" | "capital" | "capital-roman";

/** 大文字で書いた同じ並び。"(B)" は英字の、"(II)" はローマ数字の大文字。 */
const CAPITAL_OF: Readonly<Record<"letter" | "roman", Style>> = { letter: "capital", roman: "capital-roman" };

/** 小文字にした番号を形で読む。一文字の "i" は、開いたときに付けた並びの位置で見分ける。ローマ数字なら 1、英字なら 9。 */
const shapeOf = (lower: string, ordinal: number | undefined): "letter" | "roman" => {
  if (MULTI_ROMAN.test(lower)) return "roman";
  return AMBIGUOUS.test(lower) && ordinal === parseRoman(lower) ? "roman" : "letter";
};

/** 開いている項目の書き方。"(ii)" はローマ数字、"(b)" は英字、"(B)" は大文字の英字。 */
export const styleOfOpen = (open: NumberedLine): Style | undefined => {
  const inner = /^\((?<n>[A-Za-z0-9]{1,5})\)$/u.exec(open.label)?.groups?.["n"];
  if (inner === undefined) return undefined;
  if (DIGITS.test(inner) || IS_INSERTED.test(inner)) return "digit";
  const shape = shapeOf(inner.toLowerCase(), open.ordinal);
  return CAPITALS.test(inner) ? CAPITAL_OF[shape] : shape;
};

const LETTER_BEFORE_A = "a".charCodeAt(0) - 1;

/** "(b)" と "(B)" は 2 番目、"(ii)" と "(II)" も 2 番目。二文字以上の英字（"(aa)"）は並びが決まらないので付けない。 */
export const ordinalOf = (raw: string, style: Style): number | undefined => {
  if (style === "digit") return IS_INSERTED.test(raw) ? undefined : Number(raw);
  if (style === "roman" || style === "capital-roman") return parseRoman(raw);
  return raw.length === 1 ? raw.toLowerCase().charCodeAt(0) - LETTER_BEFORE_A : undefined;
};

const styles = (context: NumberingContext): (Style | undefined)[] => context.open.map(styleOfOpen);

/** "(h)" の次の "(i)"、"(H)" の次の "(I)" は英字。同じ書き方で開いている英字の次の文字なら、ローマ数字とは読まない。 */
const follows = (raw: string, style: "letter" | "capital", context: NumberingContext): boolean =>
  context.open.some((open, index) => styles(context)[index] === style && open.number.charCodeAt(0) + 1 === raw.charCodeAt(0));

/**
 * 英字の並びは (a) から始まるので、"(a)" や "(1)" のすぐ下に来た "(i)" は一段深いローマ数字。
 * 米国の規則は (a)(1)(i) の順に下る。見出しのすぐ下の "(i)" は、どちらとも決まらないので英字。
 */
const OPENS_ROMAN: ReadonlySet<Style | undefined> = new Set(["letter", "digit"]);

/** "(I)" は米国の法典で (i) の一段下の大文字ローマ数字。"(H)" の次なら英字。 */
const capitalRoman = (raw: string, open: readonly (Style | undefined)[], context: NumberingContext): boolean => {
  const lower = raw.toLowerCase();
  if (MULTI_ROMAN.test(lower)) return open.includes("capital-roman");
  if (!AMBIGUOUS.test(lower) || follows(raw, "capital", context)) return false;
  return open.includes("capital-roman") || (raw === "I" && open.at(-1) === "roman");
};

/**
 * 米国の規則は (a)(1)(i)(A) と下る。大文字の "(A)" は、開いているローマ数字のすぐ下で始まるか、開いている大文字の続きのときだけ項目。
 * 英国の法令や契約書が一段目に使う "(A)" は、何の下とも決まらないので本文のまま読む。
 */
const capitalStyleOf = (raw: string, context: NumberingContext): Style | undefined => {
  const open = styles(context);
  if (capitalRoman(raw, open, context)) return "capital-roman";
  if (!ONE_CAPITAL.test(raw)) return undefined;
  return open.includes("capital") || (raw === "A" && open.at(-1) === "roman") ? "capital" : undefined;
};

/**
 * "(i)" is a roman numeral right under "(a)" or "(1)", or when a roman list is already open; the letter i otherwise.
 * A capital "(A)" is an item only where a US regulation puts it, under a roman item; undefined elsewhere.
 */
export const styleOf = (raw: string, context: NumberingContext): Style | undefined => {
  if (DIGITS.test(raw) || IS_INSERTED.test(raw)) return "digit";
  if (CAPITALS.test(raw)) return capitalStyleOf(raw, context);
  if (MULTI_ROMAN.test(raw)) return "roman";
  if (!AMBIGUOUS.test(raw) || follows(raw, "letter", context)) return "letter";
  const open = styles(context);
  return open.includes("roman") || OPENS_ROMAN.has(open.at(-1)) ? "roman" : "letter";
};

/** The nearest open item written the same way: "(b)" closes "(i)" and sits beside "(a)". */
const siblingOf = (style: Style, context: NumberingContext): NumberedLine | undefined => {
  const open = styles(context);
  return context.open.findLast((_item, index) => open[index] === style);
};

const IS_CAPITAL: ReadonlySet<Style | undefined> = new Set(["capital", "capital-roman"]);

/**
 * "(A)" の下の "(1)" や "(i)"、"(i)" の下の "(A)" は、上に開いている同じ書き方の項目の続きではなく、一段深い並びの始まり。
 * 米国の規則は (a)(1)(i)(A) の下を、もう一度 (1) や (i) で数える。
 */
const startsBelow = (style: Style, ordinal: number | undefined, innermost: Style | undefined): boolean =>
  ordinal === 1 && style !== innermost && (IS_CAPITAL.has(innermost) || (IS_CAPITAL.has(style) && innermost === "roman"));

/**
 * A sibling has the depth of the open item written the same way. A new way of numbering goes one deeper than whatever
 * is open, and so does a first item right under a capital, or a first capital right under a roman item.
 */
export const depthFor = (style: Style, context: NumberingContext, ordinal?: number): number => {
  const innermost = context.open.at(-1);
  const deeper = (innermost?.depth ?? 0) + 1;
  if (innermost !== undefined && startsBelow(style, ordinal, styleOfOpen(innermost))) return deeper;
  return siblingOf(style, context)?.depth ?? deeper;
};

/**
 * 参照の "(A)" や "(I)" は、ローマ数字の "(iii)" の次に書かれたときだけ番地の続き。木も、大文字はローマ数字の下でしか読まない。
 * "section 5(A)" の "(A)" は番地に入れず、これまでどおり "section 5" を引く。"(h)(i)" や番号のすぐ後の "(i)" は、木と同じく英字と読む。
 */
export const continuesAddress = (part: string, before: readonly string[]): boolean => {
  if (!CAPITALS.test(part)) return true;
  const [previous, earlier] = [before.at(-1) ?? "", before.at(-2) ?? ""];
  if (MULTI_ROMAN.test(previous)) return true;
  return AMBIGUOUS.test(previous) && earlier !== "" && earlier.charCodeAt(0) + 1 !== previous.charCodeAt(0);
};

/** 番号だけの行 "(5)" は、開いている "(4)" の次のときだけ項目。本文は次の行から始まる。 */
export const continuesOpen = (style: Style, ordinal: number | undefined, context: NumberingContext): boolean => {
  const previous = siblingOf(style, context)?.ordinal;
  return ordinal !== undefined && previous !== undefined && ordinal === previous + 1;
};
