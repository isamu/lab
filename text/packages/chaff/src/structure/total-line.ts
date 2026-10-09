import { isTotalLabel, leadingText } from "./total.ts";
import { outsideBrackets } from "./connection-times.ts";

/** 合計の語に添える語。position が before なら合計の語の前だけ、after なら後ろだけ、無ければどちらにも置ける。 */
export type TotalQualifier = { readonly pattern: string; readonly position?: "before" | "after" | undefined };

/** labels: 合計の語（total-label）。qualifiers: 合計の語の前後に置いても合計の行のままの語（total-label-qualifier）。 */
export type TotalLineWords = { readonly labels: readonly string[]; readonly qualifiers: readonly TotalQualifier[] };

/** 見出しの終わり。区切り（: |）があればそこまで、無ければ金額の始まりまで。 */
const SEPARATOR = /[:：|]/u;
const AMOUNT_START = /[$€£¥￥\p{N}]/u;
const EMPHASIS = /[*_]/gu;
const SPACES = /\s+/u;

const wordsOf = (text: string): string[] =>
  text
    .toLowerCase()
    .split(SPACES)
    .filter((word) => word.length > 0);

const labelText = (lead: string): string => {
  const separator = lead.search(SEPARATOR);
  if (separator !== -1) return lead.slice(0, separator);
  const amount = lead.search(AMOUNT_START);
  return amount === -1 ? lead : lead.slice(0, amount);
};

/** 行頭の見出しを語に分ける。括弧の注記（(incl. tax)）と強調の印は除く。 */
const labelWords = (text: string): string[] => wordsOf(outsideBrackets(labelText(leadingText(text))).replace(EMPHASIS, ""));

const startsAt = (words: readonly string[], label: readonly string[], index: number): boolean => label.every((word, offset) => words[index + offset] === word);

const allowedOn = (side: "before" | "after", qualifiers: readonly TotalQualifier[]): ReadonlySet<string> =>
  new Set(
    qualifiers.filter((qualifier) => qualifier.position !== (side === "before" ? "after" : "before")).map((qualifier) => qualifier.pattern.toLowerCase()),
  );

/** 見出しの語のどこかに合計の語が一つ続けてあり、その前と後ろの語がどれも、そちら側に置ける添える語か。 */
const isQualifiedLabel = (words: readonly string[], label: readonly string[], qualifiers: readonly TotalQualifier[]): boolean => {
  const before = allowedOn("before", qualifiers);
  const after = allowedOn("after", qualifiers);
  return (
    label.length > 0 &&
    words.some(
      (_, index) =>
        startsAt(words, label, index) &&
        words.slice(0, index).every((word) => before.has(word)) &&
        words.slice(index + label.length).every((word) => after.has(word)),
    )
  );
};

/**
 * 合計の行か。合計の語で始まる行（Total、合計（月額））に加えて、合計の語に添える語だけを前後に置いた見出し
 * （Total per month、Monthly total、Total due）も合計の行と読む。添える語でない語（Total area）が入れば読まない。
 */
export const isTotalLine = (text: string, words: TotalLineWords): boolean => {
  if (isTotalLabel(text, words.labels)) return true;
  if (words.qualifiers.length === 0) return false;
  const label = labelWords(text);
  return words.labels.some((total) => isQualifiedLabel(label, wordsOf(total), words.qualifiers));
};
