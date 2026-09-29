/** 文字か数字。記号・空白・絵文字だけの並びには、読者が指せる題が無い。 */
const TITLE_CHARACTER = /[\p{L}\p{N}]/u;

/**
 * 見出しに題があるか。`###` だけの行や `## ---` は、変換で残った空の `<h3>` のような区切りで、
 * 本文の始まりでも読者が辿れる節でもない。題の無い見出しは見出しとして数えず、前後の本文を 1 つの節として読む。
 */
export const hasTitle = (headingWords: string): boolean => TITLE_CHARACTER.test(headingWords);
