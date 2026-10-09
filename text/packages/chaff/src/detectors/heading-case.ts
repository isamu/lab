import { straightApostrophes } from "../orthography.ts";
import { withoutCodeWords } from "./heading-code-words.ts";

/** 語の中のアポストロフィは ' に畳んでから読む（Fed’s）。’ を語の外に置くと、’s が小文字の語に見える。 */
const WORD = /[A-Za-z][A-Za-z'-]*/gu;

/** 小さい語は Title Case でも小文字のままなので、大文字化の判定から外す。 */
export const MINOR_WORDS: ReadonlySet<string> = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "but",
  "of",
  "in",
  "on",
  "at",
  "to",
  "for",
  "with",
  "as",
  "by",
  "from",
  "is",
  // 語の並び（WORD）は点を含まないので、vs. と v. は vs と v で拾う。
  "vs",
  "v",
  "via",
]);

/** 大文字だけの語（PR・FCPs）は略語で、どちらの流儀でも大文字のまま。Title Case の証拠にならない。 */
const ACRONYM = /^[A-Z]{2,}s?$/u;

const TITLE_DEPTH = 1;

/**
 * 見出しの頭の番号の札（Section 3. / Day 1: / Part II:）。札の語は流儀によらず大文字で始まり、続く題の語数にも数えない。
 * 番号は 3 桁までで、後ろに「.」「:」「)」か ダッシュがあるものだけ（Windows 11 Setup も Budget 2026: も札ではない）。
 */
const LEADING_LABEL = /^\s*\p{Lu}\p{Ll}+\s+(?:\d{1,3}(?:\.\d{1,3})*|[IVXLC]+)\s*[.:)\-\u2013\u2014]\s+/u;

/**
 * 見出しが Title Case か。判定できなければ undefined。fixedCase は流儀によらず大文字で書く語（曜日・月の名）で、
 * どちらの流儀の証拠にもならないので数えない。
 */
export const isTitleCase = (heading: string, fixedCase: ReadonlySet<string> = new Set()): boolean | undefined => {
  const words = [...withoutCodeWords(straightApostrophes(heading.replace(LEADING_LABEL, ""))).matchAll(WORD)]
    .map((match) => match[0])
    .filter((word) => !MINOR_WORDS.has(word.toLowerCase()) && !ACRONYM.test(word) && !fixedCase.has(word));
  // 1 語の見出しは、どちらの流儀でも先頭が大文字になる。判定できない。
  if (words.length < 2) return undefined;
  const capitalized = words.filter((word) => word[0] === word[0]?.toUpperCase()).length;
  return capitalized === words.length;
};

/**
 * 文書の題名。最初の見出しが深さ 1 で、深さ 1 の見出しがほかに無いときの、その見出し。
 * 深さ 1 が複数あると、最初のものが題名なのか章なのかを構造からは決められないので、題名とは呼ばない。
 * 見出しより前の導入部（深さ 0）は見出しではないので数えない。
 */
export const pageTitleOf = <T extends { readonly depth: number }>(sections: readonly T[]): T | undefined => {
  const headed = sections.filter((section) => section.depth > 0);
  const first = headed[0];
  if (first?.depth !== TITLE_DEPTH) return undefined;
  return headed.filter((section) => section.depth === TITLE_DEPTH).length === 1 ? first : undefined;
};

export type CaseCounts = { readonly titleCase: number; readonly sentenceCase: number };

/**
 * 節の見出しのうち少数派の流儀（true なら Title Case）。少数派が無ければ undefined。
 * 題名は数に入れない。題名は名前なので、節と流儀を分けるのはよくある揃えかた。
 * 同数のときだけ題名の流儀で決める。題名と同じ流儀のほうが、書き手の選んだ流儀である見込みが高い。
 */
export const minorityCase = (sections: CaseCounts, pageTitleCase: boolean | undefined): boolean | undefined => {
  if (sections.titleCase === sections.sentenceCase) return sections.titleCase === 0 || pageTitleCase === undefined ? undefined : !pageTitleCase;
  const minorityIsTitle = sections.titleCase < sections.sentenceCase;
  const few = minorityIsTitle ? sections.titleCase : sections.sentenceCase;
  return few === 0 ? undefined : minorityIsTitle;
};
