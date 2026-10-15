import { escapeRegExp } from "../orthography.ts";
import { abbreviates } from "./acronym-expansion.ts";

/**
 * 括弧の展開の形をとらずに、文書が略語を定義している所。契約書の定義の一覧（**"BAA"** means …、"Protected Health Information" or
 * "PHI" has the meaning …）、当事者の呼び名の並び（("Buyer" or "PNC")）、名前の後ろの言い換え（“temporary duty,” also known as “TDY”）、
 * 名前だけの行（発行者の行の HM Revenue & Customs と、本文の HMRC）。どれも文書の source から一度だけ集める。
 */

/** 言語パッケージの語彙表から読む、定義を言う語（means、has the meaning）と、名前と略語の間に書く語（also known as、hereinafter）。 */
export type DefinitionStatementWords = { readonly statements: readonly string[]; readonly markers: readonly string[] };

const oneOf = (words: readonly string[]): string => (words.length === 0 ? "(?!)" : `(?:${words.map(escapeRegExp).join("|")})`);

const ACRONYM = String.raw`[A-Z][A-Z&-]*[A-Z]`;
const OPEN_QUOTE = `["“]`;
const CLOSE_QUOTE = `["”]`;
/** 引用符で囲んだ別の呼び名。 */
const QUOTED = String.raw`${OPEN_QUOTE}[^"“”()（）\n]{1,80}${CLOSE_QUOTE}`;
/**
 * 空白・区切り・強調の印（定義の一覧は語を太字にする: **"BAA"**）と、3 文字までの小文字の語（or、and、the）。語そのものは見ない。
 * 長さに上限を置くのは、文書全体を走査するときに空白の長い並びで後戻りが膨らまないため。
 */
const GAP = String.raw`[\s,;*_]{0,8}`;
const SHORT_WORD = String.raw`\p{Ll}{1,3}(?!\p{L})`;
const JOINER = String.raw`${GAP}(?:${SHORT_WORD}${GAP}){0,3}`;
/** 呼び名どうしの間。読点か短い語が要る。並べただけの引用（"ABC" "Unrelated label"）は呼び名の並びではない。 */
const LINK = String.raw`[\s*_]{0,8}(?:,|${SHORT_WORD})${GAP}(?:${SHORT_WORD}${GAP}){0,2}`;
const QUOTED_MAX = 6;

const captured = (text: string, pattern: RegExp): string[] => [...text.matchAll(pattern)].flatMap((match) => match.groups?.["acronym"] ?? []);

/** 引用符で囲んだ略語と、その後ろの定義の語（"SOW" means、"PHI" has the meaning）。間に別の呼び名と 1 語（shall）を挟んでよい。 */
const statementDefinitions = (source: string, statements: readonly string[]): string[] =>
  statements.length === 0
    ? []
    : captured(
        source,
        new RegExp(
          String.raw`${OPEN_QUOTE}(?<acronym>${ACRONYM})${CLOSE_QUOTE}(?:${LINK}${QUOTED}){0,${QUOTED_MAX}}${JOINER}(?:\p{Ll}{1,12}\s{1,3})?${oneOf(statements)}(?![\p{L}])`,
          "gu",
        ),
      );

/** 括弧の中が、引用符で囲んだ 2 つ以上の呼び名だけの並び（("Buyer" or "PNC")、(the "Company" and "ACME")）。1 つだけの (see "PNC") は呼び名の定義ではない。 */
const LABEL_LIST = new RegExp(String.raw`[(（]${JOINER}${QUOTED}(?:${LINK}${QUOTED}){1,${QUOTED_MAX}}${GAP}[)）]`, "gu");
const QUOTED_ACRONYM = new RegExp(String.raw`${OPEN_QUOTE}(?<acronym>${ACRONYM})${CLOSE_QUOTE}`, "gu");

const labelDefinitions = (source: string): string[] => [...source.matchAll(LABEL_LIST)].flatMap((list) => captured(list[0], QUOTED_ACRONYM));

/**
 * 名前と、読点か引用符で区切った言い換えの語の後ろの、引用符で囲んだ略語（“temporary duty,” also known as “TDY”）。名前から略語の
 * 文字が順に拾えるときだけ。区切りの無い所（the "TDY" office の the）は言い換えではない。
 */
const NAME_BEFORE = String.raw`(?<name>(?:[\p{L}'’-]+\s+){0,7}[\p{L}'’-]+)[,"”]+`;

const markedDefinitions = (source: string, markers: readonly string[]): string[] =>
  markers.length === 0
    ? []
    : [...source.matchAll(new RegExp(String.raw`${NAME_BEFORE}\s${oneOf(markers)}\s+${OPEN_QUOTE}(?<acronym>${ACRONYM})${CLOSE_QUOTE}`, "gu"))]
        .filter((match) => abbreviates(match.groups?.["name"] ?? "", match.groups?.["acronym"] ?? ""))
        .flatMap((match) => match.groups?.["acronym"] ?? []);

/** 名前だけの行の語。強調の印を外した行が、大文字で始まる語と、その間の語・& だけ（HM Revenue & Customs）。見出しの行は名前の行ではない。 */
const LINE_MARKS = /[*_]/gu;
const HEADING = /^#{1,6}\s/u;
const NAME_LINE_WORD = /^(?:\p{L}[\p{L}'’.-]*|&)$/u;
const NAME_LINE_WORDS_MAX = 8;
const CAPITALS_WORD = /^\p{Lu}+$/u;
const CAPITALISED = /^\p{Lu}/u;
/** 文の終わりの記号で終わる行（Tell HMRC first.）は文で、名前の行ではない。 */
const SENTENCE_END = /[.!?:;]$/u;

const nameLineWords = (line: string): string[] => {
  const text = line.replaceAll(LINE_MARKS, " ").trim();
  if (HEADING.test(line) || SENTENCE_END.test(text)) return [];
  const words = text.split(/\s+/u);
  const isName =
    words.length >= 2 && words.length <= NAME_LINE_WORDS_MAX && CAPITALISED.test(words[0] ?? "") && words.every((word) => NAME_LINE_WORD.test(word));
  return isName ? words : [];
};

/** 名前の頭文字。大文字だけの語（HM）は全部の文字を、大文字で始まる語は頭の 1 文字を使い、小文字の語と & は飛ばす。 */
const initialsOf = (words: readonly string[]): string =>
  words
    .filter((word) => CAPITALISED.test(word))
    .map((word) => (CAPITALS_WORD.test(word) ? word : word.charAt(0)))
    .join("");

/**
 * 名前の行と読むのは、コロンで終わる短い項目名の行（From:、Published by:）のすぐ後ろの、発行者や当事者の名前の行だけ。
 * 大文字で始まり小文字が続く語が 2 つ以上あり、頭文字が 3 文字以上のもの。見出しや本文の行（## Area Forecast Discussion、
 * Advance Purchase）は、名前と略語を結ぶ書き手の印が無いので展開と読まない。
 */
const FIELD_LABEL = /^\p{Lu}[\p{L} ]{0,30}:$/u;
const NAME_LINE_INITIALS_MIN = 3;
const TITLE_WORDS_MIN = 2;

const initialsOfNameLine = (line: string): string => {
  const words = nameLineWords(line);
  const titleWords = words.filter((word) => CAPITALISED.test(word) && !CAPITALS_WORD.test(word)).length;
  const initials = initialsOf(words);
  return titleWords >= TITLE_WORDS_MIN && initials.length >= NAME_LINE_INITIALS_MIN ? initials : "";
};

const nameLineDefinitions = (source: string): string[] => {
  const lines = source
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line !== "");
  return lines
    .flatMap((line, index) => (index > 0 && FIELD_LABEL.test(lines[index - 1] ?? "") ? [initialsOfNameLine(line)] : []))
    .filter((initials) => initials !== "");
};

/** 文書が括弧の展開の形をとらずに定義した略語。 */
export const statedAcronyms = (source: string, words: DefinitionStatementWords): ReadonlySet<string> =>
  new Set([
    ...statementDefinitions(source, words.statements),
    ...labelDefinitions(source),
    ...markedDefinitions(source, words.markers),
    ...nameLineDefinitions(source),
  ]);
