// 表記のそろい。書き方の決まりのうち、文字だけで決まるもの。

/**
 * avoid が現れる位置のうち、use の一部として現れたものを除いたもの。
 * 「ユーザ」を避けて「ユーザー」と書く決まりのとき、「ユーザー」の中の「ユーザ」は指摘しない。
 */
export const occurrencesOutside = (text: string, avoid: string, use: string): number[] => {
  if (avoid === "") return [];
  const covered: [number, number][] = [];
  if (use !== "") for (let at = text.indexOf(use); at !== -1; at = text.indexOf(use, at + 1)) covered.push([at, at + use.length]);
  const found: number[] = [];
  for (let at = text.indexOf(avoid); at !== -1; at = text.indexOf(avoid, at + avoid.length)) {
    const end = at + avoid.length;
    if (!covered.some(([start, stop]) => start <= at && end <= stop)) found.push(at);
  }
  return found;
};

/** 英字は向きを問わない。数字は前と後ろを分ける。「を 3回」のように、前は空けて助数詞とは詰めるのが普通だから。 */
export type SpacingKind = "letter" | "before-digit" | "after-digit";
export type Boundary = { readonly offset: number; readonly kind: SpacingKind; readonly spaced: boolean };

const JAPANESE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー]/u;
const LETTER = /[A-Za-z]/u;
const DIGIT = /[0-9]/u;

/** Latin 側の字の種類。digitSide は、その数字が日本語の右（前に日本語）か左（後ろに日本語）か。 */
const kindOf = (char: string | undefined, digitSide: "before-digit" | "after-digit"): SpacingKind | undefined => {
  if (char === undefined) return undefined;
  if (LETTER.test(char)) return "letter";
  return DIGIT.test(char) ? digitSide : undefined;
};

const isJapanese = (char: string | undefined): boolean => char !== undefined && JAPANESE.test(char);

/** 日本語の字の隣にある英字・数字との境目。間が半角空白 1 つなら「空けている」、何も無ければ「詰めている」。 */
const boundaryAt = (chars: readonly string[], index: number): Omit<Boundary, "offset"> | undefined => {
  const [left, right, after] = [chars[index], chars[index + 1], chars[index + 2]];
  const touching = isJapanese(left) ? kindOf(right, "before-digit") : isJapanese(right) ? kindOf(left, "after-digit") : undefined;
  if (touching !== undefined) return { kind: touching, spaced: false };
  if (right !== " ") return undefined;
  const spaced = isJapanese(left) ? kindOf(after, "before-digit") : isJapanese(after) ? kindOf(left, "after-digit") : undefined;
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
