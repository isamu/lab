// 表記のそろい。書き方の決まりのうち、文字だけで決まるもの。

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

/** text の中で word が現れる [始まり, 終わり) を、左から順に。大文字小文字を区別しないときは i で探す（位置は元の文字列のまま）。 */
const spansOf = (text: string, word: string, ignoreCase: boolean): [number, number][] => {
  const pattern = new RegExp(escapeRegExp(word), ignoreCase ? "giu" : "gu");
  const found: [number, number][] = [];
  for (let match = pattern.exec(text); match !== null; match = pattern.exec(text)) {
    found.push([match.index, match.index + match[0].length]);
    // 重なって現れるものも拾う。次は 1 つ先から探す。
    pattern.lastIndex = match.index + 1;
  }
  return found;
};

/**
 * avoid が現れる位置のうち、use の一部として現れたものを除いたもの。
 * 「ユーザ」を避けて「ユーザー」と書く決まりのとき、「ユーザー」の中の「ユーザ」は指摘しない。
 * 大文字小文字は区別しない（文頭の「E-mail」も「e-mail」）。ただし二つが大文字小文字だけ違う組
 * （「Javascript」→「JavaScript」）は、それ自体が大文字小文字の決まりなので区別して探す。
 */
export const occurrencesOutside = (text: string, avoid: string, use: string): number[] => {
  if (avoid === "") return [];
  const ignoreCase = avoid.toLowerCase() !== use.toLowerCase();
  const covered = use === "" ? [] : spansOf(text, use, ignoreCase);
  const found: number[] = [];
  // covered は始まりの順に並ぶ。始まりが at 以前のものの終わりの最大が end 以上なら、どれかに収まっている。
  let next = 0;
  let reach = -1;
  let at = 0;
  for (const [start, end] of spansOf(text, avoid, ignoreCase)) {
    if (start < at) continue;
    while (next < covered.length && (covered[next]?.[0] ?? Infinity) <= start) {
      reach = Math.max(reach, covered[next]?.[1] ?? -1);
      next += 1;
    }
    if (reach < end) found.push(start);
    at = end;
  }
  return found;
};

export type SpacingKind = "letter" | "before-digit" | "after-digit";
export type Boundary = { readonly offset: number; readonly kind: SpacingKind; readonly spaced: boolean };

const JAPANESE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー]/u;
const LETTER = /[A-Za-z]/u;
const DIGIT = /\d/u;

/** Latin 側の字の種類。digitSide は、その数字が日本語の右（前に日本語）か左（後ろに日本語）か。 */
const kindOf = (char: string | undefined, digitSide: "before-digit" | "after-digit"): SpacingKind | undefined => {
  if (char === undefined) return undefined;
  if (LETTER.test(char)) return "letter";
  return DIGIT.test(char) ? digitSide : undefined;
};

const isJapanese = (char: string | undefined): boolean => char !== undefined && JAPANESE.test(char);

/** japanese が日本語の字のとき、other の英字・数字の種類。 */
const latinBeside = (japanese: string | undefined, other: string | undefined, digitSide: "before-digit" | "after-digit"): SpacingKind | undefined =>
  isJapanese(japanese) ? kindOf(other, digitSide) : undefined;

/** 日本語の字の隣にある英字・数字との境目。間が半角空白 1 つなら「空けている」、何も無ければ「詰めている」。 */
const boundaryAt = (chars: readonly string[], index: number): Omit<Boundary, "offset"> | undefined => {
  const [left, right, after] = [chars[index], chars[index + 1], chars[index + 2]];
  const touching = latinBeside(left, right, "before-digit") ?? latinBeside(right, left, "after-digit");
  if (touching !== undefined) return { kind: touching, spaced: false };
  if (right !== " ") return undefined;
  const spaced = latinBeside(left, after, "before-digit") ?? latinBeside(after, left, "after-digit");
  return spaced === undefined ? undefined : { kind: spaced, spaced: true };
};

/** 文の中の境目を全部。offset は境目の位置（左の字の直後、UTF-16）。配列を作り直さずに一度なめる。 */
export const latinBoundaries = (text: string): Boundary[] => {
  const chars = [...text];
  const found: Boundary[] = [];
  let offset = 0;
  chars.forEach((char, index) => {
    offset += char.length;
    const boundary = boundaryAt(chars, index);
    if (boundary !== undefined) found.push({ ...boundary, offset });
  });
  return found;
};

/**
 * 混ざっているとき、そろえるべき少数派。種類（英字・数字の前・数字の後ろ）ごとに数える。
 * 同数なら、文書が先に使った書き方をその文書の書き方とみなし、後から出た書き方を少数派にする。
 */
export const minorityStyle = (boundaries: readonly Boundary[]): boolean | undefined => {
  const spaced = boundaries.filter((boundary) => boundary.spaced).length;
  const touching = boundaries.length - spaced;
  if (spaced === 0 || touching === 0) return undefined;
  if (spaced !== touching) return spaced < touching;
  return !(boundaries[0]?.spaced ?? false);
};
