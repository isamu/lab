import { isTotalLabel, leadingText } from "./total.ts";
import { CELL_SEPARATOR } from "./bare-numbers.ts";
import { outsideBrackets } from "./connection-times.ts";

/** 合計の語に添える語。position が before なら合計の語の前だけ、after なら後ろだけ、無ければどちらにも置ける。 */
export type TotalQualifier = { readonly pattern: string; readonly position?: "before" | "after" | undefined };

/**
 * labels: 合計の語（total-label）。qualifiers: 合計の語の前後に置いても合計の行のままの語（total-label-qualifier）。
 * nounQualifiers: 合計に付けた名詞の前後に置いても、数える物を変えない語（total-noun-qualifier。修得単位の修得、credits earned の earned）。
 * unsummedNouns: 上の行の和とは限らない量の名詞（total-noun-unsummed。部屋を並べた表の Total area は、廊下も含みうる）。
 */
export type TotalLineWords = {
  readonly labels: readonly string[];
  readonly qualifiers: readonly TotalQualifier[];
  readonly nounQualifiers?: readonly TotalQualifier[] | undefined;
  readonly unsummedNouns?: readonly string[] | undefined;
};

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

/** 二つの字が続けて一つの英数字の語になるか。 */
const joinsWord = (left: string | undefined, right: string | undefined): boolean => WORD_CHAR.test(left ?? "") && WORD_CHAR.test(right ?? "");

const boundedAt = (text: string, total: string, index: number): boolean =>
  !joinsWord(text[index - 1], total[0]) && !joinsWord(total.at(-1), text[index + total.length]);

/** 名詞に添える語を、語の頭（修得単位の修得）と尻から除く。英数字の語の途中（earnedincome）では切らない。 */
const withoutNounQualifiers = (word: string, before: ReadonlySet<string>, after: ReadonlySet<string>): string => {
  const prefix = [...before].find((qualifier) => qualifier.length > 0 && word.startsWith(qualifier) && !joinsWord(qualifier.at(-1), word[qualifier.length]));
  const rest = prefix === undefined ? word : word.slice(prefix.length);
  const suffix = [...after].find(
    (qualifier) => qualifier.length > 0 && rest.endsWith(qualifier) && !joinsWord(rest[rest.length - qualifier.length - 1], qualifier[0]),
  );
  return suffix === undefined ? rest : rest.slice(0, rest.length - suffix.length);
};

/** 数を書いた升。強調の印と負の印（-、▲）と通貨の記号は、数の前に置ける。 */
const NUMBER_CELL = /^[*_]*[-−▲△]?[ \t]?[$€£¥￥]?[ \t]?[-−]?\p{N}/u;

/** 表の行の升。行頭の区切り（|）の前は升にしない。 */
const cellsOf = (row: string): string[] => row.trim().replace(/^\|/u, "").split(CELL_SEPARATOR);

/** 合計の行が数を書いた列の見出し。最初の列（合計の語を書いた列）は除く。 */
const summedColumnHeaders = (row: string, header: string): string[] => {
  const headers = cellsOf(header);
  return cellsOf(row)
    .map((cell, column) => ({ cell: cell.trim(), column }))
    .filter(({ cell, column }) => column > 0 && NUMBER_CELL.test(cell))
    .map(({ column }) => headers[column] ?? "");
};

type Split = { readonly before: readonly string[]; readonly after: readonly string[] };

/** 見出しの中の合計の語の位置ごとに、その前と後ろの語。日本語の「控除合計」は、合計の語の前の「控除」を一語にする。 */
const splitsAround = (text: string, total: string): Split[] =>
  Array.from({ length: text.length }, (_, index) => index)
    .filter((index) => total.length > 0 && text.startsWith(total, index) && boundedAt(text, total, index))
    .map((index) => ({ before: wordsOf(text.slice(0, index)), after: wordsOf(text.slice(index + total.length)) }));

/**
 * 合計の語に、添える語のほかに名詞（控除、deductions）を付けた見出しが、表の見出しが名指す項目の合計か。名指すのは、最初の列の
 * 見出し（控除項目の表の控除合計）か、合計の行が数を書いたどの列の見出し（単位数の列の修得単位合計）でもよい。名詞が見出しに
 * 無ければ、別の種類の量（Total tax、Total area）かもしれないので読まない。
 */
/** 合計の語の前後の語から、合計の語に添える語を除き、残った名詞から名詞に添える語（修得、earned）を除く。 */
const nounsOf = (split: Split, words: TotalLineWords): string[] => {
  const before = allowedOn("before", words.qualifiers);
  const after = allowedOn("after", words.qualifiers);
  const nounBefore = allowedOn("before", words.nounQualifiers ?? []);
  const nounAfter = allowedOn("after", words.nounQualifiers ?? []);
  return [...split.before.filter((word) => !before.has(word)), ...split.after.filter((word) => !after.has(word))]
    .map((word) => withoutNounQualifiers(word, nounBefore, nounAfter))
    .filter((word) => word.length > 0);
};

const isUnsummed = (nouns: readonly string[], unsummedNouns: readonly string[]): boolean =>
  nouns.some((noun) => unsummedNouns.some((word) => sameWord(noun, word.toLowerCase())));

/**
 * 合計の語に、添える語のほかに名詞（控除、deductions）を付けた見出しが、表の見出しが名指す項目の合計か。名指すのは、最初の列の
 * 見出し（控除項目の表の控除合計）か、合計の行が数を書いたどの列の見出し（単位数の列の修得単位合計）でもよい。名詞が見出しに
 * 無ければ、別の種類の量（Total tax、Total area）かもしれないので読まない。
 */
const isNamedTotal = (text: string, words: TotalLineWords, header: string): boolean => {
  const label = labelWords(text).join(" ");
  const firstColumn = labelWords(header);
  const columns = summedColumnHeaders(text, header).map(labelWords);
  const namesTotal = (nouns: readonly string[]): boolean =>
    !isUnsummed(nouns, words.unsummedNouns ?? []) &&
    (namesEachOther(nouns, firstColumn) || (columns.length > 0 && columns.every((headerWords) => namesEachOther(nouns, headerWords))));
  return words.labels.some((total) => splitsAround(label, total.toLowerCase()).some((split) => namesTotal(nounsOf(split, words))));
};

/**
 * 合計の行か。合計の語で始まる行（Total、合計（月額））に加えて、合計の語に添える語だけを前後に置いた見出し
 * （Total per month、Monthly total、Total due）も合計の行と読む。添える語でない語（Total area）が入れば読まない。
 * 表の見出しの行（header）を渡せば、その見出しが名指す名詞を付けた見出し（控除項目の表の控除合計、単位数の列の修得単位合計）も合計の行と読む。
 */
export const isTotalLine = (text: string, words: TotalLineWords, header?: string): boolean => {
  if (isTotalLabel(text, words.labels)) return true;
  if (words.qualifiers.length > 0) {
    const label = labelWords(text);
    if (words.labels.some((total) => isQualifiedLabel(label, wordsOf(total), words.qualifiers))) return true;
  }
  return header !== undefined && isNamedTotal(text, words, header);
};
