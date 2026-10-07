import type { Detector, Finding, ProseDocument } from "../plugin.ts";
import { escapeRegExp } from "../orthography.ts";
import { formMinority } from "./form-minority.ts";
import { quoteAround } from "./quote-around.ts";

// 一つの文書で、同じ通貨の金額を二通りに書いた所（1,000円 と ¥1,000、$20 と 20 dollars）。どちらが正しいかは決めず、少ないほうを指す。
// 通貨の書き方、それを金額のどちら側に書くか、どの通貨か（group）は語彙表 currency-notation、桁の語は amount-multiplier が言う。

export type CurrencyForm = { readonly pattern: string; readonly position: "before" | "after"; readonly currency: string };

/** 金額 1 つ。form は書き方（側と記号）、currency はその通貨。 */
export type WrittenAmount = { readonly offset: number; readonly written: string; readonly form: string; readonly currency: string };

/** 少ないほうの書き方の金額と、多いほうの書き方の例、その通貨の金額の数。 */
export type CurrencyMinority = { readonly odd: WrittenAmount; readonly usual: string; readonly count: number; readonly of: number };

export const AMOUNT = "[0-9０-９]+(?:[,，][0-9０-９]{3})*(?:[.．][0-9０-９]+)?";

const alternation = (words: readonly string[]): string => words.map(escapeRegExp).join("|");

/** 記号が英字で始まる・終わるなら、語の中（USDT、dollarsign）を読まないよう英字の切れ目を求める。 */
const latinEdge = (pattern: string, side: "start" | "end"): string => {
  const edge = side === "start" ? pattern.charAt(0) : pattern.charAt(pattern.length - 1);
  if (!/[A-Za-z]/u.test(edge)) return "";
  return side === "start" ? "(?<![A-Za-z])" : "(?![A-Za-z])";
};

const amountPattern = (form: CurrencyForm, multipliers: readonly string[]): RegExp => {
  const mark = escapeRegExp(form.pattern);
  const multiplier = multipliers.length === 0 ? "" : `(?:\\s?(?:${alternation(multipliers)}))?`;
  return form.position === "before"
    ? new RegExp(`${latinEdge(form.pattern, "start")}${mark}\\s?${AMOUNT}${multiplier}(?![A-Za-z0-9０-９])`, "gu")
    : new RegExp(`(?<![\\w.,，０-９])${AMOUNT}${multiplier}\\s?${mark}${latinEdge(form.pattern, "end")}`, "gu");
};

const overlaps = (left: WrittenAmount, right: WrittenAmount): boolean =>
  left.offset < right.offset + right.written.length && right.offset < left.offset + left.written.length;

/** 文字列の中の金額と、その書き方。重なる所に二つの書き方が当たれば、記号の長いほう（US$ と $ なら US$、米ドル と ドル なら 米ドル）。 */
export const amountsIn = (text: string, forms: readonly CurrencyForm[], multipliers: readonly string[]): WrittenAmount[] =>
  forms
    .toSorted((left, right) => right.pattern.length - left.pattern.length)
    .flatMap((form) =>
      [...text.matchAll(amountPattern(form, multipliers))].map((match) => ({
        offset: match.index,
        written: match[0],
        form: `${form.position}:${form.pattern}`,
        currency: form.currency,
      })),
    )
    .reduce<WrittenAmount[]>((kept, amount) => (kept.some((other) => overlaps(other, amount)) ? kept : [...kept, amount]), [])
    .toSorted((left, right) => left.offset - right.offset);

const minorityOf = (ofCurrency: readonly WrittenAmount[], limit: number): CurrencyMinority[] => {
  const minority = formMinority(ofCurrency, limit);
  if (minority === undefined) return [];
  return minority.odd.map((amount) => ({ odd: amount, usual: minority.usual.written, count: minority.odd.length, of: ofCurrency.length }));
};

/**
 * 通貨ごとに、多いほうと違う書き方の金額。少ないほうが limit パーセントを超えれば、使い分けている文書と読んで言わない。
 * いちばん多い書き方が同じ数で並べば、どちらにも立たない。
 */
export const currencyMinorities = (amounts: readonly WrittenAmount[], limit: number): CurrencyMinority[] =>
  [...new Set(amounts.map((amount) => amount.currency))]
    .flatMap((currency) =>
      minorityOf(
        amounts.filter((amount) => amount.currency === currency),
        limit,
      ),
    )
    .toSorted((left, right) => left.odd.offset - right.odd.offset);

export const formsOf = (doc: ProseDocument): CurrencyForm[] =>
  (doc.lexicons["currency-notation"] ?? []).flatMap((entry) =>
    entry.position === undefined || entry.group === undefined ? [] : [{ pattern: entry.pattern, position: entry.position, currency: entry.group }],
  );

export const currencyNotation: Detector = (doc, options): Finding[] => {
  const text = doc.prose ?? doc.source;
  const multipliers = (doc.lexicons["amount-multiplier"] ?? []).map((entry) => entry.pattern);
  return currencyMinorities(amountsIn(text, formsOf(doc), multipliers), options.limit).map(({ odd, usual, count, of }) => ({
    rule: "",
    severity: "info",
    line: 0,
    column: 0,
    quote: quoteAround(text, odd.offset, odd.offset + odd.written.length),
    values: { written: odd.written.trim(), usual: usual.trim(), count, of, offset: odd.offset },
  }));
};
