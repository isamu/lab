/**
 * 表の列の見出しが、それだけで全体を分けた割合の列と名指すか（割合、配点、Weight）。これらの語は文の中では行ごとの率にも使うので、
 * 見出しの升がその語だけ（単位の括弧と % は除く）のときに限る。
 */

/** 見出しの升から外す飾り: 括弧に入れた単位（(%)、（％）、[%]）、% の記号、強調の印。単位でない括弧（（達成率））は残す。 */
const DECORATION = /[(（［[](?:\s|[%％]|percent|pct)*[)）］\]]|[%％*_]/giu;
const LATIN = /^\p{ASCII}+$/u;
const WORD_BREAK = /[^\p{L}\p{N}]+/u;

const bareCell = (cell: string): string => cell.replace(DECORATION, "").trim().toLowerCase();

export const isShareColumn = (cell: string, columnLabels: readonly string[]): boolean => {
  const bare = bareCell(cell);
  return bare.length > 0 && columnLabels.some((label) => label.toLowerCase() === bare);
};

/** 英字の語は語の切れ目で探す（rate を separate に当てない）。日本語の語は文字列の中で探す。 */
const mentions = (text: string, word: string): boolean => {
  const lowered = word.toLowerCase();
  if (!LATIN.test(lowered)) return text.includes(word);
  return ` ${text.toLowerCase().split(WORD_BREAK).join(" ")} `.includes(` ${lowered} `);
};

export const mentionsAny = (text: string, words: readonly string[]): boolean => words.some((word) => mentions(text, word));
