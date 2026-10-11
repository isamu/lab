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

/** 語の変化（deduction と deductions、控除と控除項目）とみなす、長い方の語の終わりの文字数の上限。 */
const INFLECTION_SLACK = 2;
/** 見出しが名指す語の短さの下限。一文字の語（設計の「設」）は名指しとみなさない。 */
const MIN_NOUN_LENGTH = 2;
/** 英字と数字。合計の語がこの字で始まる・終わるなら、隣の字が同じ種類でないときだけ語の切れ目とみなす。 */
const WORD_CHAR = /[a-z0-9]/u;

/** 同じ語か。どちらかがもう一方で始まり、残りが二文字まで（deduction と deductions、控除と控除項目）なら同じ語と読む。 */
const sameWord = (left: string, right: string): boolean => {
  const [shorter, longer] = left.length <= right.length ? [left, right] : [right, left];
  return shorter.length >= MIN_NOUN_LENGTH && longer.startsWith(shorter) && longer.length - shorter.length <= INFLECTION_SLACK;
};

/** 名詞と見出しの語が一つずつ対応するか。見出しに名詞の無い語（Tax deduction の deduction）があれば、別の種類の量と読む。 */
const namesEachOther = (nouns: readonly string[], headerWords: readonly string[]): boolean =>
  nouns.length > 0 &&
  nouns.every((noun) => headerWords.some((word) => sameWord(noun, word))) &&
  headerWords.every((word) => nouns.some((noun) => sameWord(noun, word)));

const boundedAt = (text: string, total: string, index: number): boolean =>
  !(WORD_CHAR.test(total[0] ?? "") && WORD_CHAR.test(text[index - 1] ?? "")) &&
  !(WORD_CHAR.test(total.at(-1) ?? "") && WORD_CHAR.test(text[index + total.length] ?? ""));

/** 見出しの中の合計の語の位置ごとに、その前と後ろの語。日本語の「控除合計」は、合計の語の前の「控除」を一語にする。 */
const splitsAround = (text: string, total: string): { before: string[]; after: string[] }[] =>
  Array.from({ length: text.length }, (_, index) => index)
    .filter((index) => total.length > 0 && text.startsWith(total, index) && boundedAt(text, total, index))
    .map((index) => ({ before: wordsOf(text.slice(0, index)), after: wordsOf(text.slice(index + total.length)) }));

/**
 * 合計の語に、添える語のほかに名詞（控除、deductions）を付けた見出しが、表の見出しの升（控除項目、Deduction）が名指す
 * 項目の合計か。名詞が表の見出しに無ければ、別の種類の量（Total tax、Total area）かもしれないので読まない。
 */
const isNamedTotal = (text: string, words: TotalLineWords, header: string): boolean => {
  const label = labelWords(text).join(" ");
  const headerWords = labelWords(header);
  const before = allowedOn("before", words.qualifiers);
  const after = allowedOn("after", words.qualifiers);
  return words.labels.some((total) =>
    splitsAround(label, total.toLowerCase()).some((split) => {
      const nouns = [...split.before.filter((word) => !before.has(word)), ...split.after.filter((word) => !after.has(word))];
      return namesEachOther(nouns, headerWords);
    }),
  );
};

/**
 * 合計の行か。合計の語で始まる行（Total、合計（月額））に加えて、合計の語に添える語だけを前後に置いた見出し
 * （Total per month、Monthly total、Total due）も合計の行と読む。添える語でない語（Total area）が入れば読まない。
 * 表の見出しの行（header）を渡せば、その最初の升が名指す名詞を付けた見出し（控除項目の表の控除合計）も合計の行と読む。
 */
export const isTotalLine = (text: string, words: TotalLineWords, header?: string): boolean => {
  if (isTotalLabel(text, words.labels)) return true;
  if (words.qualifiers.length > 0) {
    const label = labelWords(text);
    if (words.labels.some((total) => isQualifiedLabel(label, wordsOf(total), words.qualifiers))) return true;
  }
  return header !== undefined && isNamedTotal(text, words, header);
};
