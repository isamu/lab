import { escapeRegExp } from "../orthography.ts";

/**
 * 展開は略語の**すぐ隣**にあるときだけ認める。
 * 60 文字も見ると、同じ文のどこかに括弧があるだけで「説明済み」になり、1 件も出なくなる。
 *
 * 認めるのは次の形。どれも実際によく書かれる。
 *   CI（継続的インテグレーション）   略語のあとに括弧
 *   Continuous Integration (CI)      括弧の中が略語
 *   Tax Cuts and Jobs Act [TCJA]     角括弧の中が略語で、直前の語の頭文字と揃う
 *   Relief Act (RA; P.L. 112-240)    括弧の最初の項目が略語で、直前の語か区切りの後の語の頭文字と揃う
 *   （single nucleotide polymorphism：SNP）  括弧の最後の項目が略語で、コロンの前の語の頭文字と揃う
 *   人事部（以下「HR」という。）      括弧の中が定義の語と略語だけ
 *   overnight reverse repurchase agreement (ON RRP)  括弧の中が空白で繋いだ略語だけで、前の名前から文字が順に拾える
 *   Partnership On Wide Energy and Resources Resilience Asia (POWERR Asia)  括弧の中が略語と添えた語で、前の名前の頭文字と揃う
 * 括弧と略語の間には、引用符（(“MNDA”)、（「MNDA」））と空白だけを許す。
 */
const WRAP = String.raw`[\s"“”'‘’「」『』]*`;
const OPENS = new RegExp(String.raw`^${WRAP}[(（]`, "u");
const CLOSES = new RegExp(String.raw`^${WRAP}[)）]`, "u");
const OPENED = new RegExp(String.raw`[(（]${WRAP}$`, "u");
const SQUARE_CLOSES = new RegExp(String.raw`^${WRAP}\]`, "u");
const SQUARE_OPENED = new RegExp(String.raw`\[${WRAP}$`, "u");
const ANY_OPENED = new RegExp(String.raw`[(（[]${WRAP}$`, "u");
/** 括弧の最初の項目のあとの区切りと、括弧が閉じるまでの残り（(ARRA; P.L. 111-5)、（OP、Originator Profile））。 */
const SEPARATED = new RegExp(String.raw`^${WRAP}[;；,，、:：](?<rest>[^()（）]*)`, "u");
/** 括弧の中の名前とコロンのあと、略語の直前まで（（single nucleotide polymorphism：SNP））。名前に区切りがあれば列挙なので外す。 */
const NAMED_BEFORE = new RegExp(String.raw`[(（](?<name>[^()（）;；,，、:：]*)[:：]${WRAP}$`, "u");
const QUOTES = /["“”'‘’「」『』]/gu;

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
const lettersOf = (acronym: string): string => acronym.replaceAll(/[&-]/gu, "");

const initialsOf = (words: readonly string[]): string =>
  words
    .filter((word) => /^[A-Z]/u.test(word))
    .map((word) => word.charAt(0))
    .join("");

const spellsOut = (before: string, acronym: string): boolean => {
  const letters = lettersOf(acronym);
  const words = before
    .replace(ANY_OPENED, "")
    .trim()
    .split(/\s+/u)
    .slice(-letters.length * 2);
  return initialsOf(words).endsWith(letters);
};

/**
 * 括弧の中で略語と組になる名前の頭文字が、略語とちょうど揃うか。大文字で始まる語だけの頭文字（Data Retention and Reuse Act）か、
 * すべての語の頭文字（single nucleotide polymorphism）で比べる。後者は大文字小文字を問わない。
 */
export const namesAcronym = (name: string, acronym: string): boolean => {
  const words = name.replace(QUOTES, " ").trim().split(/\s+/u);
  const letters = lettersOf(acronym);
  const allInitials = words.map((word) => word.charAt(0)).join("");
  return initialsOf(words) === letters || allInitials.toUpperCase() === letters.toUpperCase();
};

/**
 * 括弧の最初の項目が略語で、区切りのあとに注記が続く形（(ARRA; P.L. 111-5)、（OP、Originator Profile））。
 * 同じ形で列挙も書く（(MR, handbook, etc.)、(EPA, FDIC, GSA)）ので、直前の語か、区切りから括弧が閉じるまでの語の
 * 頭文字が略語と揃うときだけ展開と見なす。区切りの後ろは閉じた括弧の中だけを見て、頭文字がちょうど略語になることを求める。
 */
const isSeparatedAt = (body: string, acronym: string, at: number): boolean => {
  if (!OPENED.test(body.slice(Math.max(0, at - NEAR), at))) return false;
  const separated = SEPARATED.exec(body.slice(at + acronym.length, at + acronym.length + DEFINITION_REACH));
  if (separated === null) return false;
  const rest = separated.groups?.["rest"] ?? "";
  const end = at + acronym.length + separated[0].length;
  const closed = CLOSES.test(body.slice(end, end + NEAR));
  return spellsOut(body.slice(0, at), acronym) || (closed && namesAcronym(rest, acronym));
};

/** 括弧の最後の項目が略語で、コロンの前に名前を書く形（（Information-technology Promotion Agency：IPA））。 */
const isNamedBeforeAt = (body: string, acronym: string, at: number): boolean => {
  const named = NAMED_BEFORE.exec(body.slice(Math.max(0, at - DEFINITION_REACH), at));
  if (named === null || !CLOSES.test(body.slice(at + acronym.length, at + acronym.length + NEAR))) return false;
  return namesAcronym(named.groups?.["name"] ?? "", acronym);
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

/** 空白 1 つで繋いだ略語の並びのうち、at の略語の前と後ろに続く分（(ON RRP) の ON の後ろの " RRP"）。 */
const CAPITALS = "[A-Z][A-Z&-]*[A-Z]";
const JOINT_BEFORE = new RegExp(String.raw`(?:(?<![A-Za-z0-9_&-])${CAPITALS} )+$`, "u");
const JOINT_AFTER = new RegExp(String.raw`^(?: ${CAPITALS}(?![A-Za-z0-9_&-]))+`, "u");

const LOWER_WORDS = /[a-z]+/gu;

const isSubsequence = (letters: string, text: string): boolean =>
  [...text].reduce((matched, char) => (char === letters.charAt(matched) ? matched + 1 : matched), 0) === letters.length;

/**
 * 略語の文字が、名前のどれかの語の頭から始まって、名前の文字の中に順に拾えるか。1 つの略語を空白で分けて書くときは、
 * 語の頭文字ではなく語の途中の文字も使う（overnight reverse repurchase agreement → ON RRP）。見る語は略語の文字数の 2 倍まで。
 */
export const abbreviates = (name: string, acronym: string): boolean => {
  const letters = acronym.toLowerCase().replaceAll(/[^a-z]/gu, "");
  const words = (name.toLowerCase().match(LOWER_WORDS) ?? []).slice(-letters.length * 2);
  return letters !== "" && words.some((word, index) => word.startsWith(letters.charAt(0)) && isSubsequence(letters, words.slice(index).join("")));
};

/**
 * 括弧の中身が、空白で繋いだ略語の並びだけの形（(ON RRP)）。1 つの略語を 2 語以上で書いたもの。並びの文字が括弧の前の名前から
 * 順に拾えるときだけ展開と見なす。拾えなければ、空白で並べた略語の列挙（(SEC FINRA)）。
 * 括弧の外の並び（AWS KMS (Key Management Service)）は、括弧の直前の語だけが展開されるので、ここでは見ない。
 */
const isJointBracketedAt = (body: string, acronym: string, at: number): boolean => {
  const end = at + acronym.length;
  const before = JOINT_BEFORE.exec(body.slice(Math.max(0, at - DEFINITION_REACH), at))?.[0] ?? "";
  const after = JOINT_AFTER.exec(body.slice(end, end + DEFINITION_REACH))?.[0] ?? "";
  const start = at - before.length;
  const close = end + after.length;
  if (!OPENED.test(body.slice(Math.max(0, start - NEAR), start)) || !CLOSES.test(body.slice(close, close + NEAR))) return false;
  return abbreviates(body.slice(0, start), body.slice(start, close));
};

/** 括弧の中で略語に添えた、大文字で始まる語（(POWERR Asia)、(ZEC Initiative)）と、閉じる括弧。 */
const QUALIFIER = new RegExp(String.raw`^(?<words>(?: [A-Z][a-z]+)+)${WRAP}[)）]`, "u");

/**
 * 括弧の中が略語と、それに添えた語だけの形。括弧の前の名前の頭文字が略語と揃うときだけ展開と見なす（(NASA Goddard) は揃わない）。
 * 添えた語が名前の終わりにもあれば（… Resilience Asia (POWERR Asia)）、それを除いて比べる。
 */
const isQualifiedAt = (body: string, acronym: string, at: number): boolean => {
  if (!OPENED.test(body.slice(Math.max(0, at - NEAR), at))) return false;
  const end = at + acronym.length;
  const words = QUALIFIER.exec(body.slice(end, end + DEFINITION_REACH))?.groups?.["words"];
  if (words === undefined) return false;
  const name = body.slice(0, at).replace(ANY_OPENED, "").trimEnd();
  return spellsOut(name.endsWith(words) ? name.slice(0, -words.length) : name, acronym);
};

const isBracketedAt = (body: string, acronym: string, at: number): boolean => {
  const after = body.slice(at + acronym.length, at + acronym.length + NEAR);
  const before = body.slice(Math.max(0, at - NEAR), at);
  if (OPENS.test(after) || (OPENED.test(before) && CLOSES.test(after))) return true;
  if (SQUARE_OPENED.test(before) && SQUARE_CLOSES.test(after) && spellsOut(body.slice(0, at), acronym)) return true;
  return isSeparatedAt(body, acronym, at) || isNamedBeforeAt(body, acronym, at) || isJointBracketedAt(body, acronym, at) || isQualifiedAt(body, acronym, at);
};

/**
 * 記号を = で定義する書き方（where N = number of cases, EH = total hours worked）。定義は記号の後ろの語。
 * 値（EH = 2,000）、比べる・矢印（==、=>）、別の略語だけ（EH = SRE）は定義ではない。定義の語は小文字か、大小の無い文字を含む。
 * 語の値（SRE = enabled）は 1 語の定義と見分けられないので、定義と読む。値を入れる大文字の名前は設定の名前で、展開するものが無い。
 */
const EQUALS_DEFINITION = /^\s*[=＝]\s*(?=\p{L})\S*?[\p{Ll}\p{Lo}]/u;

const isEqualsDefinedAt = (body: string, acronym: string, at: number): boolean =>
  EQUALS_DEFINITION.test(body.slice(at + acronym.length, at + acronym.length + DEFINITION_REACH));

export type ExpandedAt = (body: string, acronym: string, at: number) => boolean;

/** body の at にある略語が、その場で展開・定義されているか。語彙表から一度だけ組み立てて、略語ごとに呼ぶ。 */
export const expansionAt = (words: DefinitionWords): ExpandedAt => {
  const patterns = definitionPatterns(words);
  return (body, acronym, at) => isBracketedAt(body, acronym, at) || isDefinedAt(patterns, body, acronym, at) || isEqualsDefinedAt(body, acronym, at);
};
