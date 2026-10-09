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

/**
 * 用語集の見出し語としての略語（## AFD、| AFD |、**AFD**:、- AFD —）。名前は見出し語のすぐ後ろ、つまり次の行・隣のセル・
 * 区切りの後ろに書く。見出しと表は文にならないので、文をつないだ本文ではなく source の行を見る。
 */
const TERM = String.raw`[A-Z][A-Z&-]*[A-Z]`;
const STRONG = /\*\*|__/gu;
const LIST_MARK = String.raw`(?:[-*+]|\d+[.)])\s+`;
const TERM_SEPARATOR = String.raw`(?:[:：]|\s[-–—]|[–—])`;
/** 行が略語だけの見出し・段落（## AFD、AFD:、**AFD**）。 */
const TERM_LINE = new RegExp(String.raw`^(?:#{1,6}\s+)?(?<term>${TERM})\s*(?<colon>[:：])?(?:\s+#+)?$`, "u");
/** 見出しか強調の印。印の無い「RTO:」の行はメモの見出しにも書くので、コロンを付けた略語だけの行は印があるときだけ見出し語と読む。 */
const MARKED_LINE = /^(?:#|\*\*|__)/u;
/**
 * 箇条書きの頭の略語と区切りの後ろの名前（- AFD — Area…）か、強調した略語とその後ろの名前（**AFD**: Area…、**AFD** Area…）。
 * 印の無い行頭の略語とコロン（RTO: Review ticket ownership.）は、メモの見出しにも書くので見出し語と読まない。
 */
const TERM_LEAD = new RegExp(
  String.raw`^(?:(?:${LIST_MARK})?(?<strong>\*\*|__)(?<strongTerm>${TERM})\s*(?:[:：]\s*)?\k<strong>\s*${TERM_SEPARATOR}?|${LIST_MARK}(?<term>${TERM})\s*${TERM_SEPARATOR})\s*(?<rest>\S.*)$`,
  "u",
);
const TABLE_ROW = /^\s*\|.*\|\s*$/u;
const WHOLE_TERM = new RegExp(String.raw`^${TERM}$`, "u");
/** 名前の終わり。文の終わり、区切り、括弧、空白で挟んだハイフン。読点は名前の中にも書く（Aviation, Range, and Aerospace Meteorology）ので、その前でも比べる。 */
const NAME_END = /[.;:：(（。|]|\s[-–—]\s|[–—]/u;
const NAME_COMMA = /[,，、]/u;
const LEADING_MARKS = /^[\s:：>*+-]+/u;

/** 項目の頭の名前と、その読点の前まで（Service Level Agreement, a contract → Service Level Agreement）。 */
const namesOf = (text: string): string[] => {
  const clause = (text.replaceAll(STRONG, "").replace(LEADING_MARKS, "").split(NAME_END)[0] ?? "").trim();
  return [clause, (clause.split(NAME_COMMA)[0] ?? "").trim()].filter((name) => name !== "");
};

/** 1 語の名前を縮めた略語（ABV → Above、ABNDT → Abundant）。名前は小文字を含む語で、略語そのもの（SEO.）ではない。 */
const shortensWord = (name: string, acronym: string): boolean => !/\s/u.test(name) && /\p{Ll}/u.test(name) && abbreviates(name, acronym);

const spellsName = (text: string, acronym: string): boolean => namesOf(text).some((name) => namesAcronym(name, acronym) || shortensWord(name, acronym));

const cellsOf = (row: string): string[] =>
  row
    .trim()
    .replace(/^\||\|$/gu, "")
    .split("|")
    .map((cell) => cell.replaceAll(STRONG, "").trim());

/** 表の行で、略語だけのセルの隣（後ろか前）のセルが名前のもの。 */
const tableTerms = (row: string): string[] => {
  const cells = cellsOf(row);
  return cells.filter(
    (cell, index) => WHOLE_TERM.test(cell) && [cells[index + 1], cells[index - 1]].some((next) => next !== undefined && spellsName(next, cell)),
  );
};

const leadTerm = (line: string): string[] => {
  const lead = TERM_LEAD.exec(line.trim());
  const term = lead?.groups?.["strongTerm"] ?? lead?.groups?.["term"];
  return term !== undefined && spellsName(lead?.groups?.["rest"] ?? "", term) ? [term] : [];
};

/** 見出し語から名前までに見る行の数。空行が 2 つ挟まっても、次の段落を見る。 */
const NEXT_LINE_REACH = 3;

/** 略語だけの行と、その次の空でない行が名前のもの。 */
const lineTerm = (lines: readonly string[], index: number): string[] => {
  const line = (lines[index] ?? "").trim();
  const groups = TERM_LINE.exec(line.replaceAll(STRONG, ""))?.groups;
  const term = groups?.["term"];
  if (term === undefined || (groups?.["colon"] !== undefined && !MARKED_LINE.test(line))) return [];
  const next = lines.slice(index + 1, index + 1 + NEXT_LINE_REACH).find((line) => line.trim() !== "");
  return next !== undefined && spellsName(next, term) ? [term] : [];
};

const FENCE = /^ {0,3}(?<fence>`{3,}|~{3,})/u;
const FRONT_MATTER_EDGE = /^(?:---|\.\.\.)\s*$/u;

type FenceScan = { readonly open: string | undefined; readonly kept: string[] };

/** 閉じる行は記号の並びだけ。後ろに語がある行（```ts）は囲みの中の行。 */
const CLOSING_FENCE = /^ {0,3}(?<fence>`{3,}|~{3,})\s*$/u;

const closes = (line: string, open: string): boolean => CLOSING_FENCE.exec(line)?.groups?.["fence"]?.startsWith(open) === true;

/** コードの囲みの中の行（開き・閉じの行も）を空にする。閉じるのは同じ記号で、開きと同じか長い並び。 */
const withoutFences = (lines: readonly string[]): string[] =>
  lines.reduce<FenceScan>(
    (scan, line) => {
      const fence = FENCE.exec(line)?.groups?.["fence"];
      const inside = scan.open !== undefined || fence !== undefined;
      scan.kept.push(inside ? "" : line);
      if (scan.open === undefined) return { open: fence, kept: scan.kept };
      return { open: closes(line, scan.open) ? undefined : scan.open, kept: scan.kept };
    },
    { open: undefined, kept: [] },
  ).kept;

/** 文書の頭の front matter（--- で始まり --- か ... で閉じる）の行数。無ければ 0。 */
const frontMatterLength = (lines: readonly string[]): number =>
  lines[0]?.trim() === "---" ? lines.findIndex((line, index) => index > 0 && FRONT_MATTER_EDGE.test(line)) + 1 : 0;

/** 4 桁以上の字下げはコードとして書ける。入れ子の箇条書きと見分けずに外す（外しても、略語が報告されるほうへ倒れるだけ）。 */
const INDENTED = /^(?: {4}|\t)/u;

/** 本文として読まない行（front matter、コードの囲み、字下げしたコード）を空にした行。行の位置は変えない。 */
const proseLines = (lines: readonly string[]): string[] => {
  const skipped = frontMatterLength(lines);
  return withoutFences(lines.map((line, index) => (index < skipped || INDENTED.test(line) ? "" : line)));
};

/**
 * 名前で確かめられた見出し語がこれだけある文書は、用語集。用語集では、見出し語の後ろの段落はどれも定義なので、名前の文字が揃わない
 * 項目（ADVIS: In hydrologic terms, a program…、AMVER: Automated Mutual Assistance Vessel Rescue System）も説明済みと読む。
 * 用語集でない文書の、略語だけの行（PDF、IMAGE）や見出し（### MATLAB）の後ろは、定義ではなく本文や添え書き。
 */
const GLOSSARY_ENTRIES = 5;

/** 見出し語の行。大文字の語を空白か / で並べたもの（A AMS、AMVER/SEAS）。1 文字の語（A）は略語ではないので見出し語に数えない。 */
const HEADWORD_WORD = String.raw`[A-Z][A-Z&-]*`;
const HEADWORD_LINE = new RegExp(String.raw`^(?:#{1,6}\s+)?(?<words>${HEADWORD_WORD}(?:[ /]${HEADWORD_WORD})*)\s*(?<colon>[:：])?(?:\s+#+)?$`, "u");
const HEADING_LINE = /^#{1,6}\s/u;

/** 定義の段落。小文字の語を含み（次の見出し語ではなく）、見出しでもない行。 */
const isDefinitionLine = (line: string): boolean => /\p{Ll}/u.test(line) && !HEADING_LINE.test(line);

/** 用語集の、見出し語だけの行と、その次の空でない行が定義の段落のもの。 */
const glossaryLineTerms = (lines: readonly string[], index: number): string[] => {
  const line = (lines[index] ?? "").trim();
  const groups = HEADWORD_LINE.exec(line.replaceAll(STRONG, ""))?.groups;
  if (groups?.["words"] === undefined || (groups["colon"] !== undefined && !MARKED_LINE.test(line))) return [];
  const next = lines.slice(index + 1, index + 1 + NEXT_LINE_REACH).find((candidate) => candidate.trim() !== "");
  return next !== undefined && isDefinitionLine(next.trim()) ? groups["words"].split(/[ /]/u).filter((word) => WHOLE_TERM.test(word)) : [];
};

/** 用語集の、印を付けた見出し語と区切りの後ろの定義（**ADVIS**: In hydrologic terms…、- ADVIS — a program…）。 */
const glossaryLeadTerm = (line: string): string[] => {
  const lead = TERM_LEAD.exec(line.trim());
  const term = lead?.groups?.["strongTerm"] ?? lead?.groups?.["term"];
  return term !== undefined && /\p{Ll}/u.test(lead?.groups?.["rest"] ?? "") ? [term] : [];
};

const termsOf = (lines: readonly string[], index: number): string[] => {
  const line = lines[index] ?? "";
  return TABLE_ROW.test(line) ? tableTerms(line) : [...lineTerm(lines, index), ...leadTerm(line)];
};

const glossaryTermsOf = (lines: readonly string[], index: number): string[] => [...glossaryLineTerms(lines, index), ...glossaryLeadTerm(lines[index] ?? "")];

/** 用語集の見出し語として、すぐ後ろに名前を書いた略語。用語集と読める文書では、名前でなくても定義を書いた略語。 */
export const termEntryAcronyms = (source: string): ReadonlySet<string> => {
  const lines = proseLines(source.split(/\r?\n/u));
  const named = lines.flatMap((_, index) => termsOf(lines, index));
  if (new Set(named).size < GLOSSARY_ENTRIES) return new Set(named);
  return new Set([...named, ...lines.flatMap((_, index) => glossaryTermsOf(lines, index))]);
};

export type ExpandedAt = (body: string, acronym: string, at: number) => boolean;

/** body の at にある略語が、その場で展開・定義されているか。語彙表から一度だけ組み立てて、略語ごとに呼ぶ。 */
export const expansionAt = (words: DefinitionWords): ExpandedAt => {
  const patterns = definitionPatterns(words);
  return (body, acronym, at) => isBracketedAt(body, acronym, at) || isDefinedAt(patterns, body, acronym, at) || isEqualsDefinedAt(body, acronym, at);
};
