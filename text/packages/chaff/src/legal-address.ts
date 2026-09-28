/**
 * 「第二十二条第二項」は法令の番地の書き方で、漢数字で書く決まりだから割りようがない。「第」と「条」「項」「号」が
 * 語の切れ目を示しているので、読み手が区切りを探すこともない。番地は漢字の連なりに数えず、前後を切る区切りとして扱う。
 */
const KANJI_NUMERAL = "[〇一二三四五六七八九十百千]+";
const ADDRESS_UNIT = "[条項号章節款目編]";
const LEGAL_ADDRESS = new RegExp(`第${KANJI_NUMERAL}${ADDRESS_UNIT}(?:の${KANJI_NUMERAL})*`, "gu");

export const maskLegalAddresses = (text: string): string => text.replace(LEGAL_ADDRESS, " ");
