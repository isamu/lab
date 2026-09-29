// 角括弧の見出し語を、文書が一覧に載せているか。一覧の項目は行頭の [語] で始まり、その後ろは行末か、
// 2 つ以上の空白かタブで本文と離れる（ぶら下げの組み方）。行頭の [語] に空白 1 つで文が続くのは本文。

const LISTED = /^[ \t]*\[(?<tag>[^[\]\s]{1,60})\](?:[ \t]*\r?$|[ \t]{2,}|\t)/u;

/** 文書が一覧の項目として載せている角括弧の見出し語（括弧を除く）。 */
export const listedTags = (source: string): ReadonlySet<string> => new Set(source.split("\n").flatMap((line) => LISTED.exec(line)?.groups?.["tag"] ?? []));
