import type { Detector, Finding } from "../plugin.ts";
import { headingWords } from "../structure-shape/heading-words.ts";
import { quoteAround } from "./quote-around.ts";

// 目次の項目が、文書のどの見出しとも合わない所。目次の見出しは語彙表 toc-heading が言う。
// 項目と見出しは、空白・記号・大文字小文字を無視して比べ、頭の番号（1.2、2-1、第3章）を外しても比べる。

/** 見出しの無い目次の項目 1 つ。entry は項目の言葉（リンクなら字の部分）。 */
export type StrayTocEntry = { readonly offset: number; readonly entry: string };

type Line = { readonly text: string; readonly offset: number };
type Heading = { readonly title: string; readonly offset: number };

const HEADING = /^[ \t]{0,3}#{1,6}[ \t]/u;
const FENCE = /^[ \t]*(?:```|~~~)/u;
const LIST_ITEM = /^[ \t]*(?:[-*+]|\d{1,3}[.)])[ \t]/u;
const LINK_TEXT = /^\[(?<text>[^\]]*)\]\([^)]*\)/u;
const ATTRIBUTES = /\{#[^}]*\}/gu;
const DIGIT = /[\d０-９]/u;
const LEADER_DOTS = new Set([".", "…", "・"]);
const MIN_LEADER = 2;
/** 目次の項目のうち見出しに合わないものがこれより多ければ、目次は別の書き方の見出し（本文に無い章立て）と読んで言わない。 */
const MAX_STRAY_SHARE = 0.5;

const linesOf = (source: string): Line[] => [...source.matchAll(/^.*$/gmu)].map((match) => ({ text: match[0], offset: match.index }));

/** コードの囲みの外の行。 */
const outsideFences = (lines: readonly Line[]): Line[] => {
  const fence = { open: false };
  return lines.filter((line) => {
    if (FENCE.test(line.text)) {
      fence.open = !fence.open;
      return false;
    }
    return !fence.open;
  });
};

/** 比べるための形。全角を半角にそろえ（４ と 4）、空白・記号を消し、小文字にする。 */
const comparable = (text: string): string =>
  text
    .replace(ATTRIBUTES, "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\p{P}\p{S}]/gu, "");

/** 頭の番号（1.2、2-1、第3章）と飾りを外した、比べるための形。 */
const withoutNumber = (text: string): string => comparable(headingWords(text));

/** text の終わりから、isTail に当たる字を外したもの。 */
const trimTail = (text: string, isTail: (char: string) => boolean): string => {
  const chars = [...text];
  return chars.slice(0, chars.findLastIndex((char) => !isTail(char)) + 1).join("");
};

/** 見出しの行の題（頭と終わりの # を外す）。見出しでなければ undefined。 */
const headingTitle = (line: string): string | undefined => {
  if (!HEADING.test(line)) return undefined;
  const withoutMarks = line.trim().replace(/^#+/u, "").trim();
  return trimTail(withoutMarks, (char) => char === "#").trim();
};

/** 終わりのページ番号（「背景 ........ 3」の 3 と点線）。点線の無い数（Step 3）は題のうち。 */
const withoutPageNumber = (text: string): string => {
  const before = trimTail(text, (char) => DIGIT.test(char)).trimEnd();
  if (before === text.trimEnd()) return text;
  const title = trimTail(before, (char) => LEADER_DOTS.has(char));
  return before.length - title.length >= MIN_LEADER ? title.trim() : text;
};

/** 項目の言葉と、項目の行の中でそれが始まる所。リンクなら字の部分（番号の後ろのリンク「1. [概要](#…)」も）。 */
const entryOf = (item: string): { readonly text: string; readonly start: number } => {
  const bracket = item.indexOf("[");
  const link = bracket === -1 ? undefined : LINK_TEXT.exec(item.slice(bracket))?.groups?.["text"];
  if (link !== undefined) return { text: withoutPageNumber(link), start: bracket + 1 };
  return { text: withoutPageNumber(item.trim()), start: item.length - item.trimStart().length };
};

const matchesHeading = (entry: string, headings: readonly Heading[]): boolean =>
  headings.some(
    (heading) => comparable(heading.title) === comparable(entry) || (withoutNumber(entry) !== "" && withoutNumber(heading.title) === withoutNumber(entry)),
  );

/** 目次の見出しの下（次の見出しまで）の箇条書きの項目。 */
const entriesUnder = (lines: readonly Line[], tocAt: number): Line[] => {
  const after = lines.filter((line) => line.offset > tocAt);
  const end = after.findIndex((line) => HEADING.test(line.text));
  return (end === -1 ? after : after.slice(0, end)).flatMap((line) => {
    const marker = LIST_ITEM.exec(line.text)?.[0];
    if (marker === undefined) return [];
    const entry = entryOf(line.text.slice(marker.length));
    return [{ text: entry.text, offset: line.offset + marker.length + entry.start }];
  });
};

/** 文書の目次の項目のうち、どの見出しとも合わないもの。 */
export const strayTocEntries = (source: string, tocWords: readonly string[]): StrayTocEntry[] => {
  const lines = outsideFences(linesOf(source));
  const headings = lines.flatMap((line) => {
    const title = headingTitle(line.text);
    return title === undefined ? [] : [{ title, offset: line.offset }];
  });
  const tocNames = new Set(tocWords.map(comparable));
  return headings
    .filter((heading) => tocNames.has(comparable(heading.title)))
    .flatMap((toc) => {
      const entries = entriesUnder(lines, toc.offset).filter((entry) => entry.text !== "");
      const others = headings.filter((heading) => heading !== toc);
      const stray = entries.filter((entry) => !matchesHeading(entry.text, others));
      return stray.length > entries.length * MAX_STRAY_SHARE ? [] : stray.map((entry) => ({ offset: entry.offset, entry: entry.text }));
    });
};

export const tocHeading: Detector = (doc): Finding[] =>
  strayTocEntries(
    doc.source,
    (doc.lexicons["toc-heading"] ?? []).map((entry) => entry.pattern),
  ).map((stray) => ({
    rule: "",
    severity: "warning",
    line: 0,
    column: 0,
    quote: quoteAround(doc.source, stray.offset, stray.offset + stray.entry.length),
    values: { entry: stray.entry, offset: stray.offset },
  }));
