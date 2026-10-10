import type { Span, StructureNode } from "../plugin.ts";
import { escapeRegExp } from "../orthography.ts";
import { inDocumentOrder } from "./issues.ts";

// 定義した語が本文で使われているか、定義より前に使われていないか。どちらも木の定義と、本文の文の字面だけで決まる。

/** bare は、定義の語（means・以下…という・the）の無い括弧の引用（("Seller")）。例を引く括弧と同じ形。 */
export type DefinedTerm = { readonly term: string; readonly span: Span; readonly line: number; readonly inline: boolean; readonly bare?: boolean };

/** 文書の位置 [start, end) の語が、使ったのではなく引用符で例として挙げただけか。 */
export type Mentioned = (start: number, end: number) => boolean;

const NEVER_MENTIONED: Mentioned = () => false;

/** 本文の一続き（文）。start は文書の中の位置。 */
export type BodyText = { readonly start: number; readonly text: string };

export type TermUse = { readonly term: DefinedTerm; readonly offset: number };

/** 強調の印（"**Agreement**"）は語の一部ではない。 */
const EMPHASIS_MARKS = /[*_]+/gu;
/** 語の長さの上限。これより長い引用（表の見出し、文）は、定義した語ではない。 */
const MAX_TERM_WORDS = 6;
/** 文の区切りや問いを含むもの（"What do you think about...?"）は、引いた言葉で、定義した語ではない。 */
const NOT_A_TERM = /(?:[?!,;:…。、？！]|\.$)/u;
const HAS_LETTER = /\p{L}/u;

const isTerm = (term: string): boolean => HAS_LETTER.test(term) && !NOT_A_TERM.test(term) && term.split(/\s+/u).length <= MAX_TERM_WORDS;

/** 木の定義を文書の順に。語でないものは外す。inline は文の途中で括弧に入れた定義（(the "Seller")、以下「甲」という）。 */
export const definedTerms = (tree: StructureNode): DefinedTerm[] =>
  inDocumentOrder(tree).flatMap((node) => {
    const term =
      node.kind === "definition"
        ? String(node.attrs["term"] ?? "")
            .replaceAll(EMPHASIS_MARKS, "")
            .trim()
        : "";
    const bare = node.attrs["form"] === "bare" ? { bare: true } : {};
    return isTerm(term) ? [{ term, span: node.span, line: node.line, inline: node.attrs["placement"] === "inline", ...bare }] : [];
  });

const LATIN_EDGE = /^[\p{Script=Latin}\p{N}]|[\p{Script=Latin}\p{N}]$/u;
/** 一字の漢字の語（「法」「甲」）は、漢字の後ろに続く所（方法、法律の前の「方」）では別の語の一部。 */
const SINGLE_KANJI = /^\p{Script=Han}$/u;

/** loose は最初の一字の大小を問わない（文頭の "Personal data"）。exact は書いたとおりだけ（"Access" は "early access" に当たらない）。 */
type CaseMatch = "loose" | "exact";

/**
 * 語の現れを探す形。英字で始まる・終わる語は語の途中に当たらない（"Term" は "Terms" には当たり、"Termination" には当たらない）。
 * 複数形と所有の形（Services、Policies、Seller's）は同じ語の使用。
 */
const termPattern = (term: string, caseMatch: CaseMatch): RegExp => {
  const first = term.charAt(0);
  const rest = /\p{Ll}y$/u.test(term) ? `${escapeRegExp(term.slice(1, -1))}(?:y|ie)` : escapeRegExp(term.slice(1));
  const caseless = caseMatch === "exact" || first.toUpperCase() === first.toLowerCase();
  const head = caseless ? escapeRegExp(first) : `[${escapeRegExp(first.toUpperCase())}${escapeRegExp(first.toLowerCase())}]`;
  if (SINGLE_KANJI.test(term)) return new RegExp(String.raw`(?<!\p{Script=Han})${head}`, "gu");
  if (!LATIN_EDGE.test(term)) return new RegExp(`${head}${rest}`, "gu");
  return new RegExp(String.raw`(?<![\p{Script=Latin}\p{N}])${head}${rest}(?:e?s|['’]s?)?(?![\p{Script=Latin}\p{N}])`, "gu");
};

const inside = (offset: number, spans: readonly Span[]): boolean => spans.some((span) => span.start <= offset && offset < span.end);

/**
 * 語の現れ（文書の中の位置）を順に。定義そのもの（"Seller" means、(the "Seller")）の中の現れは使用に数えない。
 * mentioned が言う現れ（引用符で例として挙げただけ）も数えない。
 */
export const usesOf = (
  term: string,
  texts: readonly BodyText[],
  definitionSpans: readonly Span[],
  caseMatch: CaseMatch = "loose",
  mentioned: Mentioned = NEVER_MENTIONED,
): number[] => {
  const pattern = termPattern(term, caseMatch);
  return texts.flatMap((body) =>
    [...body.text.matchAll(pattern)]
      .filter((match) => !mentioned(body.start + match.index, body.start + match.index + match[0].length))
      .map((match) => body.start + match.index)
      .filter((offset) => !inside(offset, definitionSpans)),
  );
};

type TermGroup = { readonly first: DefinedTerm; readonly spans: readonly Span[] };

/** 語ごとに、最初の定義と、その語のすべての定義の範囲。定義が何千あっても語の数だけ回る。 */
const groupsOf = (terms: readonly DefinedTerm[]): TermGroup[] => {
  const groups = new Map<string, { first: DefinedTerm; spans: Span[] }>();
  terms.forEach((defined) => {
    const group = groups.get(defined.term);
    if (group === undefined) groups.set(defined.term, { first: defined, spans: [defined.span] });
    else group.spans.push(defined.span);
  });
  return [...groups.values()];
};

/** 定義したのに、定義の外で一度も使っていない語。同じ語の定義が二つあれば、最初の一つだけを言う（二つ目は duplicate-definition）。 */
export const unusedDefinitions = (terms: readonly DefinedTerm[], texts: readonly BodyText[], mentioned: Mentioned = NEVER_MENTIONED): DefinedTerm[] => {
  const groups = groupsOf(terms);
  const examples = quotesExamples(groups, texts, mentioned);
  return groups
    .filter((group) => !(examples && group.first.bare === true) && usesOf(group.first.term, texts, group.spans).length === 0)
    .map((group) => group.first);
};

/**
 * 定義の語の無い括弧の引用（("Seller")）を、文書が一つも本文で使っていなければ、それは定義ではなく例の引用
 * （Plain verbs, not metaphors ("silently fails")）。引用符で挙げただけの現れは使用に数えない。
 */
const quotesExamples = (groups: readonly TermGroup[], texts: readonly BodyText[], mentioned: Mentioned): boolean =>
  !groups.some((group) => group.first.bare === true && usesOf(group.first.term, texts, group.spans, "loose", mentioned).length > 0);

/** offset を含む文。texts は start の昇順で、二分探索で引く。 */
const sentenceAt = (texts: readonly BodyText[], offset: number): BodyText | undefined => {
  let low = 0;
  let high = texts.length - 1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    const body = texts[middle];
    if (body === undefined) return undefined;
    if (offset < body.start) high = middle - 1;
    else if (offset >= body.start + body.text.length) low = middle + 1;
    else return body;
  }
  return undefined;
};

const LETTER = /\p{L}/gu;
/** 札の文が語のほかに持ってよい字の数（"The Agreement." の The）。 */
const LABEL_SLACK = 3;

/** 語だけの札の文（**12.2.** Taxes.、1. The Agreement.）。条の頭に語を掲げただけで、使用ではない。 */
const isLabel = (body: BodyText | undefined, term: string): boolean =>
  body !== undefined && (body.text.replaceAll(term, "").match(LETTER) ?? []).length <= LABEL_SLACK;

/** 文書の位置が、題・見出し・条の見出しの行にあるか。見出しは節の中身に名前を付けるだけで、語を使った所ではない。 */
export type IsTitle = (offset: number) => boolean;

const NEVER_TITLE: IsTitle = () => false;

const HAN = /\p{Script=Han}/u;

/** 漢字で終わる語の後ろに漢字が続く現れは、もっと長い語の一部（監査委員会の監査委員、保険金請求権の保険金請求）。 */
const continuesInHan = (texts: readonly BodyText[], term: string, offset: number): boolean => {
  const body = sentenceAt(texts, offset);
  return body !== undefined && HAN.test(term.at(-1) ?? "") && HAN.test(body.text.charAt(offset - body.start + term.length));
};

/** 半角の長音・濁点・中黒（ｰ ﾞ ﾟ ･）は Katakana の字ではないが、片仮名の名前の一部。 */
const KATAKANA = /[\p{Script=Katakana}ーｰﾞﾟ]/u;
const NAKAGURO = /[・･]/u;

/** 語の外側の隣の字（next）とその向こうの字（beyond）が、片仮名か「・片仮名」か。 */
const katakanaJoins = (next: string, beyond: string): boolean => KATAKANA.test(next) || (NAKAGURO.test(next) && KATAKANA.test(beyond));

/**
 * 片仮名の端に片仮名が続く現れ、または「・」で片仮名とつないだ現れは、もっと長い名前の一部
 * （クリエイティブ・コモンズ・パブリック・ライセンスのパブリック・ライセンス、サブライセンスのライセンス）。
 */
const insideKatakanaName = (texts: readonly BodyText[], term: string, offset: number): boolean => {
  const body = sentenceAt(texts, offset);
  if (body === undefined) return false;
  const at = offset - body.start;
  const end = at + term.length;
  const joinedBefore = at > 0 && katakanaJoins(body.text.charAt(at - 1), at > 1 ? body.text.charAt(at - 2) : "");
  const joinedAfter = katakanaJoins(body.text.charAt(end), body.text.charAt(end + 1));
  return (KATAKANA.test(term.charAt(0)) && joinedBefore) || (KATAKANA.test(term.at(-1) ?? "") && joinedAfter);
};

/** 長い名前の写しと読むのに、語の前で定義の名前と重ならなければならない字の数（手引き の前の「の」と「成」）。 */
const MIN_ECHO = 2;
const OPENING_BRACKET = /[\s（(]/u;

/** 定義の括弧を開けた字（（、空白）を後ろから外した、括弧の前の名前。 */
const nameBefore = (text: string): string => {
  let end = text.length;
  while (end > 0 && OPENING_BRACKET.test(text.charAt(end - 1))) end -= 1;
  return text.slice(0, end);
};

/** 二つの文字列が後ろから何字重なるか。 */
const sharedTail = (left: string, right: string): number => {
  let shared = 0;
  while (shared < left.length && shared < right.length && left.at(-1 - shared) === right.at(-1 - shared)) shared += 1;
  return shared;
};

/**
 * 定義の括弧の前に書いた長い名前（…ガイドライン作成の手引き（以下、「手引き」という。））を、定義より前でそのまま書いた所。
 * 名前が語で終わり、語の前の字も名前と同じなら、それは長い名前で、定義した短い名前の使用ではない。
 */
const echoesLongName = (texts: readonly BodyText[], defined: DefinedTerm, offset: number): boolean => {
  const defining = sentenceAt(texts, defined.span.start);
  const using = sentenceAt(texts, offset);
  if (defining === undefined || using === undefined) return false;
  const name = nameBefore(defining.text.slice(0, defined.span.start - defining.start));
  const written = using.text.slice(0, offset - using.start + defined.term.length);
  return name.endsWith(defined.term) && sharedTail(name, written) >= defined.term.length + MIN_ECHO;
};

const CAPITAL_OR_NON_LATIN = /\p{Lu}|[^\p{Script=Latin}\p{N}\s\p{P}]/u;

/**
 * 前で使ったと言える語。小文字の英語（("vendors")）はふつうの語としても使うので、前の現れが定義した語の使用とは限らない。
 * 一字の漢字（「法」「令」）は、令和や方法の一部にも当たる。
 */
const isDistinctive = (term: string): boolean => CAPITAL_OR_NON_LATIN.test(term) && !SINGLE_KANJI.test(term);

/**
 * 文の途中で括弧に入れて定義した語（(the "Seller")、以下「甲」という）を、その定義の文より前で使っている所。最初の一つだけ。
 * 定義の文の中の現れ（株式会社GovTech東京（以下「GovTech東京」という。））は、定義する名前そのものなので数えない。札の文も、
 * isTitle が言う題・見出しの行も、漢字で終わる語にさらに漢字が続く長い語の一部も、定義の括弧の前の長い名前を写した所も数えない。
 * 定義の条（"Seller" means、「甲」とは）は条の並びの頭にも終わりにも置く書き方があるので、前で使っても言わない。
 * 定義の語の無い括弧の引用（("The key point is")）は例の引用と同じ形なので、その語を引用符で挙げただけの現れ
 * （Its sentences open with "The key point is"）は使用ではない。定義の語のある定義（(the "Seller")、以下「買主」という）は、
 * 引用符に入れた現れ（The "Seller" ships）も使用。
 */
export const usesBeforeDefinition = (
  terms: readonly DefinedTerm[],
  texts: readonly BodyText[],
  mentioned: Mentioned = NEVER_MENTIONED,
  isTitle: IsTitle = NEVER_TITLE,
): TermUse[] =>
  groupsOf(terms)
    .filter((group) => group.first.inline && isDistinctive(group.first.term))
    .flatMap(({ first: defined, spans }) => {
      const defining = sentenceAt(texts, defined.span.start)?.start ?? defined.span.start;
      const uses = usesOf(defined.term, texts, spans, "exact", defined.bare === true ? mentioned : NEVER_MENTIONED);
      const first = uses.find(
        (offset) =>
          !isLabel(sentenceAt(texts, offset), defined.term) &&
          !isTitle(offset) &&
          !continuesInHan(texts, defined.term, offset) &&
          !insideKatakanaName(texts, defined.term, offset) &&
          !echoesLongName(texts, defined, offset),
      );
      return first !== undefined && first < defining ? [{ term: defined, offset: first }] : [];
    });
