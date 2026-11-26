import type { Detector, Finding, Span } from "../plugin.ts";
import { BARE_URL } from "../bare-url.ts";
import { escapeRegExp } from "../orthography.ts";
import { quoteAround } from "./quote-around.ts";
import { mergeSpans } from "../span-merge.ts";
import { firstEndingAfter } from "../soft-break.ts";
import { isLabelClose, isLabelInAside } from "./bracket-label.ts";
import { isTitleDateOpen } from "./bracket-title-date.ts";
import { isInchMark } from "./inch-mark.ts";
import { isEmoticonMouth } from "./emoticon.ts";

/**
 * 括弧の組。どの言語でも同じ字の決まりなので、語彙表ではなくここに置く。family は形（丸・角）で、全角と半角は同じ形の別の幅。
 * 英語の "…" と '…' は開きと閉じが同じ字で、' は省略の印（don't）と見分けられないので入れない。
 */
type Bracket = { readonly open: string; readonly close: string; readonly family: string };

const BRACKETS: readonly Bracket[] = [
  { open: "「", close: "」", family: "kagi" },
  { open: "｢", close: "｣", family: "kagi" },
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

/** continues は、行の頭で同じ引用符を開き直したときの、その前の開き（詩の引用は行ごとに開き直し、終わりで一度だけ閉じる）。 */
type Open = { readonly bracket: Bracket; readonly offset: number; readonly continues?: Open };
/** strays は、開きの無い閉じの引用符（”）のうち、同じ行の後ろの ” と組になるのを待つものの位置。 */
type Scan = { readonly open: Open[]; readonly problems: BracketProblem[]; readonly strays: number[] };

/** 半角の「｢｣」。幅の違いは hankaku-kana が指すので、全角と組んでも幅の違いとしては指さない。 */
const HALFWIDTH_KAGI: ReadonlySet<string> = new Set(["｢", "｣"]);

const isWidthSlip = (opened: Bracket, closing: Bracket): boolean =>
  opened !== closing && !HALFWIDTH_KAGI.has(opened.open) && !HALFWIDTH_KAGI.has(closing.close);

const unclosedOf = (entry: Open): BracketProblem => ({ kind: "unclosed", offset: entry.offset, mark: entry.bracket.open });

/**
 * 開きの無い ” の後ろの、同じ行の ” か（”天気”）。開きを閉じの字で書いた一つの誤りで、後ろの ” はその閉じとして正しい。
 * 指すのは前の ” だけにする。
 */
const pairsStray = (scan: Scan, text: string, offset: number): boolean => {
  const stray = scan.strays.pop();
  return stray !== undefined && !text.slice(stray, offset).includes("\n");
};

const closeWith = (scan: Scan, text: string, bracket: Bracket, offset: number): void => {
  const at = scan.open.findLastIndex((entry) => entry.bracket.family === bracket.family);
  const round = bracket.family === "round";
  if (at === -1) {
    if (bracket.family === "quote" && pairsStray(scan, text, offset)) return;
    if (!(round && isLabelClose(text, offset))) scan.problems.push({ kind: "unopened", offset, mark: bracket.close });
    if (bracket.family === "quote") scan.strays.push(offset);
    return;
  }
  if (round && isLabelInAside(text, offset, scan.open.filter((entry) => entry.bracket.family === "round").length)) return;
  const opened = scan.open[at];
  // 間に残った開きは、この閉じより先に閉じるはずだったもの。ただし引用の閉じのすぐ前の開きは、括弧の字そのものを
  // 引いたもの（法令の読替え「取締役（」とあるのは「清算人（」と）で、組を作らない。
  scan.open
    .splice(at)
    .slice(1)
    .filter((inner) => !(QUOTATIONS.has(bracket.family) && inner.offset === offset - 1))
    .forEach((inner) => scan.problems.push(unclosedOf(inner)));
  if (opened !== undefined && isWidthSlip(opened.bracket, bracket))
    scan.problems.push({ kind: "mismatch", offset, mark: bracket.close, partner: opened.bracket.open });
  if (opened !== undefined && reopenedLines(opened) >= MIN_REOPENED_LINES) dropContinued(scan, opened.continues);
};

/**
 * 行の頭で開き直した数がこれより少なければ、行の頭の引用符は中に引いた言葉（“I told her\n“go away” and left.”）と読む。
 * 詩の引用は二行以上を続けて開き直す。
 */
const MIN_REOPENED_LINES = 2;

const reopenedLines = (entry: Open | undefined): number => (entry?.continues === undefined ? 0 : 1 + reopenedLines(entry.continues));

/** 閉じた引用が開き直しで続けてきた前の開きを、閉じたものとして外す。 */
const dropContinued = (scan: Scan, prior: Open | undefined): void => {
  if (prior === undefined || scan.open.at(-1) !== prior) return;
  scan.open.pop();
  dropContinued(scan, prior.continues);
};

/** 段落（空行で区切った塊）の最初の字。 */
const PARAGRAPH_HEAD = /(?:^|\n[ \t\u3000]*\n)[ \t\u3000]*(?=\S)/gu;

const paragraphHeads = (text: string): ReadonlySet<number> => new Set([...text.matchAll(PARAGRAPH_HEAD)].map((match) => match.index + match[0].length));

/** 行の最初の字（字下げの後ろ）。 */
const LINE_HEAD = /(?:^|\n)[ \t\u3000]*(?=\S)/gu;

const lineHeads = (text: string): ReadonlySet<number> => new Set([...text.matchAll(LINE_HEAD)].map((match) => match.index + match[0].length));

type Heads = { readonly paragraphs: ReadonlySet<number>; readonly lines: ReadonlySet<number> };

/** 人の言葉を引く括弧。続く段落を同じ開きで始めて、引用が続くことを示す書き方がある。 */
const QUOTATIONS: ReadonlySet<string> = new Set(["quote", "kagi", "double-kagi"]);

/** 空行。詩の連や、詩の一つ一つの区切り。 */
const BLANK_LINE = /\n[ \t\u3000]*\n/u;

const openWith = (scan: Scan, text: string, bracket: Bracket, offset: number, heads: Heads): void => {
  const top = scan.open.at(-1);
  const reopens = QUOTATIONS.has(bracket.family) && top?.bracket === bracket;
  // 段落をまたぐ台詞・引用（英語の小説）は、閉じずに次の段落を同じ開きで始める。前の開きはここで続く。
  if (reopens && heads.paragraphs.has(offset)) scan.open.pop();
  // 行の頭では、閉じるまで続きかどうか決められない。折り返した台詞の行の頭の開きは、中に引いた別の言葉のこともある。
  // 続きと読むのは同じ連の中だけ。前の詩で閉じ忘れた開きを、次の詩の引用の続きにはしない。
  const sameStanza = top !== undefined && !BLANK_LINE.test(text.slice(top.offset, offset));
  const continues = reopens && sameStanza && !heads.paragraphs.has(offset) && heads.lines.has(offset) ? top : undefined;
  scan.open.push(continues === undefined ? { bracket, offset } : { bracket, offset, continues });
};

/**
 * 一つの節の中の括弧の組を読む。text は節の文字列で、offset は text の中の位置。
 * 詩の連や、段落をまたぐ引用があるので、括弧は段落を越えて組にする。節の終わりまで閉じない開きを指摘する。題の行で日付を添える開き（Year of Meteors [1859-60）は除く。
 */
export const bracketProblems = (text: string): BracketProblem[] => {
  const scan: Scan = { open: [], problems: [], strays: [] };
  const heads: Heads = { paragraphs: paragraphHeads(text), lines: lineHeads(text) };
  [...text.matchAll(MARKS)].forEach((match) => {
    const quoteOpen = scan.open.some((entry) => entry.bracket.family === "quote");
    if (isInchMark(text, match.index, quoteOpen) || isEmoticonMouth(text, match.index)) return;
    const opening = BY_OPEN.get(match[0]);
    const closing = BY_CLOSE.get(match[0]);
    if (opening !== undefined) openWith(scan, text, opening, match.index, heads);
    else if (closing !== undefined) closeWith(scan, text, closing, match.index);
  });
  const unclosed = scan.open.filter((entry) => !isTitleDateOpen(text, entry.offset)).map(unclosedOf);
  return [...scan.problems, ...unclosed].toSorted((left, right) => left.offset - right.offset);
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
