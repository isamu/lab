// 日本語の数の読み方。条番号・数量・日付が同じ読み方を使う。

const DIGIT: Readonly<Record<string, number>> = { 〇: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
const PLACE: Readonly<Record<string, number>> = { 十: 10, 百: 100, 千: 1000 };
/** 万・億は、そこまでの数全体を桁上げする。「十二万五千」= 125000。 */
const MYRIAD: Readonly<Record<string, number>> = { 万: 10_000, 億: 100_000_000 };

const FULLWIDTH_ZERO = 0xff10;

export const toHalfWidth = (text: string): string => text.replace(/[０-９]/gu, (char) => String(char.charCodeAt(0) - FULLWIDTH_ZERO));

type Reading = { readonly done: number; readonly total: number; readonly current: number };

const step = (acc: Reading, char: string): Reading => {
  const myriad = MYRIAD[char];
  if (myriad !== undefined) return { done: acc.done + (acc.total + acc.current || 1) * myriad, total: 0, current: 0 };
  const place = PLACE[char];
  if (place !== undefined) return { done: acc.done, total: acc.total + (acc.current === 0 ? 1 : acc.current) * place, current: 0 };
  return { done: acc.done, total: acc.total, current: acc.current * 10 + (DIGIT[char] ?? 0) };
};

/**
 * 番号や数を数にする。全角数字は半角に、漢数字は位取りで読む（十二 = 12、二十一 = 21、百五 = 105、一〇 = 10）。
 * 算用数字と万・億の組（「10万」）も読む。小数（「1.5」）も読む。読めないものは undefined。
 * 番号を読み違えると番地が変わり、参照先が無いという誤りを作ってしまう。
 */
export const parseJapaneseNumber = (text: string): number | undefined => {
  const half = toHalfWidth(text).replace(/,/gu, "");
  if (/^\d+(?:\.\d+)?$/u.test(half)) return Number(half);
  const arabicMyriad = /^(?<n>\d+(?:\.\d+)?)(?<unit>[万億])$/u.exec(half)?.groups;
  if (arabicMyriad?.["n"] !== undefined && arabicMyriad["unit"] !== undefined) return Number(arabicMyriad["n"]) * (MYRIAD[arabicMyriad["unit"]] ?? 1);
  if (!/^[〇一二三四五六七八九十百千万億]+$/u.test(text)) return undefined;
  const { done, total, current } = [...text].reduce(step, { done: 0, total: 0, current: 0 });
  return done + total + current;
};
