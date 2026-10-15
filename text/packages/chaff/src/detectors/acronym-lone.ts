// 説明のない略語が上限に届かない文書で、それでも 1 つを指してよいかを決める手がかり。

/** 大文字で始まり小文字が続く語（International、Treasury）。名前を作る語の形。 */
const TITLE_WORD_AFTER = /^[\s–-]+\p{Lu}\p{Ll}/u;
const TITLE_WORD_BEFORE = /\p{Lu}\p{Ll}+[\s–-]+$/u;
/** 文の頭の語は、名前でなくても大文字で始まる（The CFR）。 */
const FIRST_WORD = /^\P{L}*\p{L}+[\s–-]+$/u;

/**
 * 略語が、大文字で始まる語と並んで 1 つの名前を作っているか（SRI International、HM Treasury、Math FMA）。
 * 名前の一部の略語は、読み手が名前として受け取るもので、展開を待つ略語とは言い切れない。start と end は文の中の略語の位置。
 */
export const isNamePart = (sentence: string, start: number, end: number): boolean => {
  const before = sentence.slice(0, start);
  return TITLE_WORD_AFTER.test(sentence.slice(end)) || (TITLE_WORD_BEFORE.test(before) && !FIRST_WORD.test(before));
};

/**
 * 略語だけを括弧に入れた所があるか（National Vulnerability Database (NVD)）。書き手が名前を書いて略語を添えた、いちばん確かな展開の形。
 * 略語の後ろの括弧（README ([#1455](…))）はリンクや注記にも使うので、書き手が展開する人かを測るときは数えない。
 */
export const isBracketed = (text: string, acronym: string): boolean => new RegExp(String.raw`[(（]\s?["“「]?${acronym}["”」]?\s?[)）]`, "u").test(text);

/** 見出しに出る略語は、その文書が扱う相手の名前（NASA Selects …）。読み手はそれを知って読みに来る。 */
export const isInHeading = (headings: readonly string[], acronym: string): boolean =>
  headings.some((heading) => new RegExp(String.raw`(?<![A-Za-z0-9_&])${acronym}(?![A-Za-z0-9_&])`, "u").test(heading));
