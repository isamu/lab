import { escapeRegExp } from "../orthography.ts";

/**
 * 展開は略語の**すぐ隣**にあるときだけ認める。
 * 60 文字も見ると、同じ文のどこかに括弧があるだけで「説明済み」になり、1 件も出なくなる。
 *
 * 認めるのは 4 つの形。どれも実際によく書かれる。
 *   CI（継続的インテグレーション）   略語のあとに括弧
 *   Continuous Integration (CI)      括弧の中が略語
 *   Tax Cuts and Jobs Act [TCJA]     角括弧の中が略語で、直前の語の頭文字と揃う
 *   人事部（以下「HR」という。）      括弧の中が定義の語と略語だけ
 * 括弧と略語の間には、引用符（(“MNDA”)、（「MNDA」））と空白だけを許す。
 */
const WRAP = String.raw`[\s"“”'‘’「」『』]*`;
const OPENS = new RegExp(String.raw`^${WRAP}[(（]`, "u");
const CLOSES = new RegExp(String.raw`^${WRAP}[)）]`, "u");
const OPENED = new RegExp(String.raw`[(（]${WRAP}$`, "u");
const SQUARE_CLOSES = new RegExp(String.raw`^${WRAP}\]`, "u");
const SQUARE_OPENED = new RegExp(String.raw`\[${WRAP}$`, "u");

/** 括弧と略語の間の幅。空白は 1 つに畳んであるので、(“ MNDA ”) まで収まる。 */
const NEAR = 3;

/** 定義の語を挟む形で、括弧から略語まで・略語から括弧までに見る幅。(hereinafter referred to as “SLA”) が収まる。 */
const DEFINITION_REACH = 60;

/** 定義の語どうし、定義の語と略語の間に来てよいもの（以下、HR）。英字が続けば語の途中（(theSLA)）。 */
const MARKER_GAP = String.raw`(?![A-Za-z])[\s、,]*`;

/**
 * 角括弧は引用の印にも使う（[IANA]、[1]）。直前の語のうち大文字で始まる語の頭文字が
 * 略語と揃うときだけ展開と見なす。見る語は略語の文字数の 2 倍まで（and や of を挟むため）。
 */
const spellsOut = (before: string, acronym: string): boolean => {
  const letters = acronym.replaceAll("&", "");
  const words = before
    .replace(SQUARE_OPENED, "")
    .trim()
    .split(/\s+/u)
    .slice(-letters.length * 2);
  const initials = words.filter((word) => /^[A-Z]/u.test(word)).map((word) => word.charAt(0));
  return initials.join("").endsWith(letters);
};

/** 言語パッケージの語彙表から読む、括弧の中で略語の前に書く語（以下、hereinafter）と後ろに書く語（という）。 */
export type DefinitionWords = { readonly markers: readonly string[]; readonly verbs: readonly string[] };

type DefinitionPatterns = { readonly opened: RegExp; readonly closes: RegExp };

const oneOf = (words: readonly string[]): string => (words.length === 0 ? "(?!)" : words.map(escapeRegExp).join("|"));

const definitionPatterns = (words: DefinitionWords): DefinitionPatterns => ({
  opened: new RegExp(String.raw`[(（]\s*(?<markers>(?:(?:${oneOf(words.markers)})${MARKER_GAP})*)${WRAP}(?<![A-Za-z])$`, "iu"),
  closes: new RegExp(String.raw`^${WRAP}(?<verb>(?:${oneOf(words.verbs)})[。.]?)?${WRAP}[)）]`, "iu"),
});

/**
 * 括弧の中に定義の語と略語だけがある形。語が 1 つも無い（CI）は OPENED と CLOSES が見るので、ここでは数えない。
 * 括弧の中身が語と略語で尽きることを求めるので、ふつうの意味の「以下」（（以下のSRE手順））は定義にならない。
 */
const isDefinedAt = (patterns: DefinitionPatterns, body: string, acronym: string, at: number): boolean => {
  const opened = patterns.opened.exec(body.slice(Math.max(0, at - DEFINITION_REACH), at));
  const closes = patterns.closes.exec(body.slice(at + acronym.length, at + acronym.length + DEFINITION_REACH));
  if (opened === null || closes === null) return false;
  return (opened.groups?.["markers"] ?? "") !== "" || (closes.groups?.["verb"] ?? "") !== "";
};

const isBracketedAt = (body: string, acronym: string, at: number): boolean => {
  const after = body.slice(at + acronym.length, at + acronym.length + NEAR);
  const before = body.slice(Math.max(0, at - NEAR), at);
  if (OPENS.test(after) || (OPENED.test(before) && CLOSES.test(after))) return true;
  return SQUARE_OPENED.test(before) && SQUARE_CLOSES.test(after) && spellsOut(body.slice(0, at), acronym);
};

export type ExpandedAt = (body: string, acronym: string, at: number) => boolean;

/** body の at にある略語が、その場で展開・定義されているか。語彙表から一度だけ組み立てて、略語ごとに呼ぶ。 */
export const expansionAt = (words: DefinitionWords): ExpandedAt => {
  const patterns = definitionPatterns(words);
  return (body, acronym, at) => isBracketedAt(body, acronym, at) || isDefinedAt(patterns, body, acronym, at);
};
