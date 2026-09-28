/**
 * 「第二十二条第二項」は法令の番地の書き方で、漢数字で書く決まりだから割りようがない。「第」と「条」「項」「号」が
 * 語の切れ目を示しているので、読み手が区切りを探すこともない。番地は漢字の連なりに数えず、前後を切る区切りとして扱う。
 */
const KANJI_NUMERAL = "[〇一二三四五六七八九十百千]+";
const ADDRESS_UNIT = "[条項号章節款目編]";

/**
 * 番地のすぐ後ろに続けてよい漢字は、法令が番地に付ける語だけ。「第一条件」「第十項目」「第一目標」は番地ではなく普通の語なので、
 * ここに無い漢字が続くときは番地として扱わない。
 */
const FOLLOWS_ADDRESS = "[^\\p{Script=Han}]|$|第|各号|各項|及|又|若|並|中|本文|前段|後段|但書|同条|乃至";

const LEGAL_ADDRESS = new RegExp(`第${KANJI_NUMERAL}${ADDRESS_UNIT}(?:の${KANJI_NUMERAL})*(?=${FOLLOWS_ADDRESS})`, "gu");

export const maskLegalAddresses = (text: string): string => text.replace(LEGAL_ADDRESS, " ");
