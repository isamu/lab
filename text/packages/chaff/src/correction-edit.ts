// 誤った形と正しい形の組から、書いた語のどこをどう直すかを決める。純粋な関数だけを置く。

/** wrong の上の [start, end) を replacement にすると right になる。前後の同じ字は含めない。 */
export type Edit = { readonly start: number; readonly end: number; readonly replacement: string };

const commonPrefix = (left: string, right: string): number => {
  const limit = Math.min(left.length, right.length);
  const differs = [...Array(limit).keys()].find((at) => left[at] !== right[at]);
  return differs ?? limit;
};

/** 二つの形の違う所。前の同じ字を先に除き、残りから後ろの同じ字を除く（「ですす」と「です」は、後ろの「す」を足した所）。 */
export const editBetween = (wrong: string, right: string): Edit => {
  const start = commonPrefix(wrong, right);
  const tail = commonPrefix(Array.from(wrong.slice(start)).reverse().join(""), Array.from(right.slice(start)).reverse().join(""));
  return { start, end: wrong.length - tail, replacement: right.slice(start, right.length - tail) };
};

/** 指す字と、そこに入る正しい形。指す字は、書いた字の頭から。 */
export type Correction = { readonly matched: string; readonly suggestion: string };

const capitalised = (word: string): string => `${word.charAt(0).toUpperCase()}${word.slice(1)}`;

const isAllCapitals = (word: string): boolean => /\p{Lu}.*\p{Lu}/u.test(word) && !/\p{Ll}/u.test(word);

/** 書いた語の大文字に合わせる（文頭の "Teh" には "The"、"TEH" には "THE"）。 */
const casedLike = (written: string, suggestion: string): string => {
  if (isAllCapitals(written)) return suggestion.toUpperCase();
  return /^\p{Lu}/u.test(written) && /^\p{Ll}/u.test(suggestion) ? capitalised(suggestion) : suggestion;
};

/**
 * 書いた字（written）に、語彙表の組の違い（edit）を当てる。boundaries は written の中の語の終わりの位置で、written.length を含む。
 * 指すのは written の頭から、違う所を含む語の終わりまで。後ろに続く前後の語は言わない（「以外と簡単」は「以外」を「意外」に、
 * 活用した「始めて会った」は「始めて」を「初めて」に）。written の頭が誤った形の違う所まで同じでなければ（活用で字が変わった）undefined。
 */
export const correctionIn = (written: string, wrong: string, edit: Edit, boundaries: readonly number[]): Correction | undefined => {
  if (written.slice(0, edit.end).toLowerCase() !== wrong.slice(0, edit.end).toLowerCase()) return undefined;
  const end = Math.min(written.length, ...boundaries.filter((at) => at >= edit.end));
  const matched = written.slice(0, end);
  const suggestion = `${matched.slice(0, edit.start)}${edit.replacement}${matched.slice(edit.end)}`;
  return { matched, suggestion: casedLike(matched, suggestion) };
};
