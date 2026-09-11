/**
 * core が「どのアダプタを取りに行くか」を決めるためだけの当て推量。spec §17.2。
 *
 * アダプタを読み込む前に動く必要があるので、ここは辞書も依存も持てない。
 * アダプタ側の detect() とは層が違う。あちらは読み込み済みの候補から選ぶための
 * 権威ある点数で、こちらは何も読み込んでいない状態での見当付け。
 * 似た計算を両方が持つのは、この順序から来る避けられない重複。
 *
 * 呼ぶ側が、コードブロック・インラインコード・URL・front matter を先に落としておくこと。
 * 技術文書は英語のコードを大量に含むため、落とさないと日本語文書が英語と判定される。
 */
const JAPANESE = /[぀-ゟ゠-ヿ一-鿿]/gu;
const LATIN_LETTER = /[a-z]/giu;
const COUNTABLE = /\S/gu;

// 共有した /g 正規表現を exec で回すと lastIndex が持ち越されて数え落とす。
// matchAll は内部で複製するので、その事故が起きない。
const count = (text: string, pattern: RegExp): number => [...text.matchAll(pattern)].length;

const ratio = (text: string, pattern: RegExp): number => {
  const total = count(text, COUNTABLE);
  if (total === 0) return 0;
  return count(text, pattern) / total;
};

export const japaneseRatio = (text: string): number => ratio(text, JAPANESE);

export const latinRatio = (text: string): number => ratio(text, LATIN_LETTER);
