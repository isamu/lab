import type { Detector, Finding, Span } from "../plugin.ts";
import { BARE_URL } from "../bare-url.ts";
import { escapeRegExp } from "../orthography.ts";
import { quoteAround } from "./quote-around.ts";
import { mergeSpans } from "../span-merge.ts";
import { firstEndingAfter } from "../soft-break.ts";

/**
 * 括弧の組。どの言語でも同じ字の決まりなので、語彙表ではなくここに置く。family は形（丸・角）で、全角と半角は同じ形の別の幅。
 * 英語の "…" と '…' は開きと閉じが同じ字で、' は省略の印（don't）と見分けられないので入れない。
 */
type Bracket = { readonly open: string; readonly close: string; readonly family: string };

const BRACKETS: readonly Bracket[] = [
  { open: "「", close: "」", family: "kagi" },
  { open: "『", close: "』", family: "double-kagi" },
  { open: "（", close: "）", family: "round" },
  { open: "(", close: ")", family: "round" },
  { open: "［", close: "］", family: "square" },
  { open: "[", close: "]", family: "square" },
  { open: "【", close: "】", family: "lenticular" },
  { open: "〔", close: "〕", family: "tortoise" },
  { open: "〈", close: "〉", family: "angle" },
  { open: "《", close: "》", family: "double-angle" },
  { open: "“", close: "”", family: "quote" },
];

const BY_OPEN = new Map(BRACKETS.map((bracket) => [bracket.open, bracket]));
const BY_CLOSE = new Map(BRACKETS.map((bracket) => [bracket.close, bracket]));

/** 括弧の字のどれか。どれも BMP の字なので、見つけた位置がそのまま UTF-16 の位置になる。 */
const MARKS = new RegExp(
  BRACKETS.flatMap((bracket) => [bracket.open, bracket.close])
    .map(escapeRegExp)
    .join("|"),
  "gu",
);

export type BracketProblem = {
  /** unclosed は節の中で閉じない開き、unopened は開きの無い閉じ、mismatch は全角と半角で組んだもの（（…)）。 */
  readonly kind: "unclosed" | "unopened" | "mismatch";
  readonly offset: number;
  readonly mark: string;
  /** mismatch のときの、組んだ相手の字。 */
  readonly partner?: string;
};

type Open = { readonly bracket: Bracket; readonly offset: number };
type Scan = { readonly open: Open[]; readonly problems: BracketProblem[] };

/**
 * 丸括弧の閉じの前の、行の頭か空白・句読点の後ろに書いた短い印（「1)」「a)」「事例）」「※）」）と、数の後ろの閉じ（「事例2）及び事例3）」）。
 * 箇条の番号や見出しの印で、開きを持たない書き方。顔文字の「:)」も同じ形。印に使うのは丸括弧だけ。
 */
const LABEL_BEFORE = /(?:^|[\s、。,;:：])[^\s()（）[\]［］「」『』]{1,3}[ \t\u3000]?$|[\d０-９]$/u;

const isLabel = (text: string, bracket: Bracket, offset: number): boolean => {
  if (bracket.family !== "round") return false;
  const lineStart = text.lastIndexOf("\n", offset - 1) + 1;
  return LABEL_BEFORE.test(text.slice(lineStart, offset));
};

const unclosedOf = (entry: Open): BracketProblem => ({ kind: "unclosed", offset: entry.offset, mark: entry.bracket.open });

const closeWith = (scan: Scan, text: string, bracket: Bracket, offset: number): void => {
  const at = scan.open.findLastIndex((entry) => entry.bracket.family === bracket.family);
  if (at === -1) {
    if (!isLabel(text, bracket, offset)) scan.problems.push({ kind: "unopened", offset, mark: bracket.close });
    return;
  }
  const opened = scan.open[at];
  // 間に残った開きは、この閉じより先に閉じるはずだったもの。ただし引用の閉じのすぐ前の開きは、括弧の字そのものを
  // 引いたもの（法令の読替え「取締役（」とあるのは「清算人（」と）で、組を作らない。
  scan.open
    .splice(at)
    .slice(1)
    .filter((inner) => !(QUOTATIONS.has(bracket.family) && inner.offset === offset - 1))
    .forEach((inner) => scan.problems.push(unclosedOf(inner)));
  if (opened !== undefined && opened.bracket !== bracket) scan.problems.push({ kind: "mismatch", offset, mark: bracket.close, partner: opened.bracket.open });
};

/** 段落（空行で区切った塊）の最初の字。 */
const PARAGRAPH_HEAD = /(?:^|\n[ \t\u3000]*\n)[ \t\u3000]*(?=\S)/gu;

const paragraphHeads = (text: string): ReadonlySet<number> => new Set([...text.matchAll(PARAGRAPH_HEAD)].map((match) => match.index + match[0].length));

/** 人の言葉を引く括弧。続く段落を同じ開きで始めて、引用が続くことを示す書き方がある。 */
const QUOTATIONS: ReadonlySet<string> = new Set(["quote", "kagi", "double-kagi"]);

const openWith = (scan: Scan, bracket: Bracket, offset: number, opensParagraph: boolean): void => {
  // 段落をまたぐ台詞・引用（英語の小説）は、閉じずに次の段落を同じ開きで始める。前の開きはここで続く。
  // 行の頭では続きと読まない。折り返した台詞の行の頭の開きは、中に引いた別の言葉のこともある。
  if (opensParagraph && QUOTATIONS.has(bracket.family) && scan.open.at(-1)?.bracket === bracket) scan.open.pop();
  scan.open.push({ bracket, offset });
};

/**
 * 一つの節の中の括弧の組を読む。text は節の文字列で、offset は text の中の位置。
 * 詩の連や、段落をまたぐ引用があるので、括弧は段落を越えて組にする。節の終わりまで閉じない開きを指摘する。
 */
export const bracketProblems = (text: string): BracketProblem[] => {
  const scan: Scan = { open: [], problems: [] };
  const heads = paragraphHeads(text);
  [...text.matchAll(MARKS)].forEach((match) => {
    const opening = BY_OPEN.get(match[0]);
    const closing = BY_CLOSE.get(match[0]);
    if (opening !== undefined) openWith(scan, opening, match.index, heads.has(match.index));
    else if (closing !== undefined) closeWith(scan, text, closing, match.index);
  });
  return [...scan.problems, ...scan.open.map(unclosedOf)].toSorted((left, right) => left.offset - right.offset);
};

/** sorted（昇順・接しもしない）で、offset の後ろの最初の境目: offset を含む範囲の終わりか、次の範囲の始まり。 */
const borderAfter = (sorted: readonly Span[], offset: number): number => {
  const next = sorted[firstEndingAfter(sorted, offset)];
  if (next === undefined) return Number.POSITIVE_INFINITY;
  return next.start <= offset ? next.end : next.start;
};

/** 覆いの中で URL そのものが終わる位置。ASCII でない字か、コードと字のまま見える範囲の境目（「`https://…`）」の「`」）で終わる。 */
const urlProperEnd = (written: string, start: number, readable: readonly Span[]): number => {
  const nonAscii = written.search(/[^\p{ASCII}]/u);
  return Math.min(nonAscii === -1 ? written.length : nonAscii, borderAfter(readable, start) - start, written.length);
};

/** sorted（昇順・重ならない）のうち range に重なるものを、range の中に切り詰めたもの。何万もの字の節があっても、URL ごとに全部をなめない。 */
const clippedTo = (sorted: readonly Span[], range: Span): Span[] =>
  sorted
    .slice(firstEndingAfter(sorted, range.start), firstEndingAfter(sorted, range.end) + 1)
    .filter((span) => span.start < range.end)
    .map((span) => ({ start: Math.max(span.start, range.start), end: Math.min(span.end, range.end) }));

/**
 * 本文（prose）では URL を覆うが、覆いは空白まで取るので、URL の直後に続けて書いた字（「（https://example.jp/）」の「）」）まで消える。
 * 読み手には見えている字なので、URL が終わった後ろの、字のまま見える範囲（texts）を元に戻す。コードの中の URL の後ろも同じ。
 */
export const withRunOnRestored = (prose: string, source: string, texts: readonly Span[]): string => {
  const readable = mergeSpans(texts, true);
  const parts: string[] = [];
  const cursor = { at: 0 };
  [...source.matchAll(BARE_URL)].forEach((match) => {
    const tail = { start: match.index + urlProperEnd(match[0], match.index, readable), end: match.index + match[0].length };
    clippedTo(readable, tail).forEach((span) => {
      parts.push(prose.slice(cursor.at, span.start), source.slice(span.start, span.end));
      cursor.at = span.end;
    });
  });
  parts.push(prose.slice(cursor.at));
  return parts.join("");
};

const findingOf = (text: string, problem: BracketProblem): Finding => ({
  rule: "",
  severity: "warning",
  line: 0,
  column: 0,
  quote: quoteAround(text, problem.offset),
  values: { mark: problem.mark, partner: problem.partner ?? "", offset: problem.offset },
  variant: problem.kind,
});

/** 見出しで区切った節ごとに読む。見出しの行は本文で覆ってある。 */
export const unbalancedBracket: Detector = (doc): Finding[] => {
  const text = withRunOnRestored(doc.prose ?? doc.source, doc.source, doc.markup?.texts ?? []);
  return doc.sections.flatMap((section) =>
    bracketProblems(text.slice(section.span.start, section.span.end)).map((problem) =>
      findingOf(text, { ...problem, offset: section.span.start + problem.offset }),
    ),
  );
};
