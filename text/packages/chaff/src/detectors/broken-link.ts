import type { Detector, Finding, Markup, ProseDocument, Span } from "../plugin.ts";
import { findingAt, markupOf, quoteOf } from "./markup-finding.ts";

/** ページの先頭を指す書き方。見出しが無くても行き先がある。 */
const PAGE_TOP = new Set(["", "top"]);

/** 名前を比べる形。字と数字だけを小文字で残す。見出しから名前を作る決まりは表示するものごとに違う（空白を - にする・記号を消す）ので、その違いを畳む。 */
export const anchorKey = (name: string): string => name.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

/** 同じ見出しが二つあると、表示するものは二つ目以降に -1、-2 を付ける。 */
const DUPLICATE_SUFFIX = /-\d+$/u;

const decoded = (fragment: string): string => {
  try {
    return decodeURIComponent(fragment);
  } catch {
    return fragment;
  }
};

/** 文書の中の、名前を持つところ（見出しと、書き手が付けた id）の形。 */
/** 「&」を and と読んで名前を作るもの（M&IE → m-and-ie）もある。 */
const namesOf = (text: string): string[] => [text, text.replaceAll("&", " and ")];

export const anchorKeys = (markup: Markup): ReadonlySet<string> =>
  new Set([...markup.headings.map((heading) => heading.text), ...markup.ids].flatMap(namesOf).map(anchorKey));

/** `#…` の行き先が、文書の中の見出しか id を指しているか。 */
export const reachesAnchor = (destination: string, keys: ReadonlySet<string>): boolean => {
  const fragment = decoded(destination.slice(1));
  if (PAGE_TOP.has(fragment.toLowerCase())) return true;
  return keys.has(anchorKey(fragment)) || keys.has(anchorKey(fragment.replace(DUPLICATE_SUFFIX, "")));
};

/**
 * 参照の形で書いたのに名前の定義（`[label]: url`）が無いもの（`[text][label]`、`[text][]`）。字のまま表示される。
 * 定義があれば CommonMark はリンクにするので、字のまま残った参照の形は定義が無い。英数字のすぐ後ろの括弧（A[i][j]）は配列の添字。
 */
const REFERENCE_LIKE = /(?<![\\A-Za-z0-9_\]])\[([^[\]\n]+)\]\[([^[\]\n]*)\]/gu;

/** 数だけの括弧（[1][2]、[3, 4]）は、参照の記法ではなく文献の番号を並べたもの。 */
const CITATION_NUMBERS = /^[\d\s,，、–-]+$/u;

export const unresolvedReferences = (source: string, markup: Markup): Span[] =>
  markup.texts.flatMap((text) =>
    [...source.slice(text.start, text.end).matchAll(REFERENCE_LIKE)]
      .filter((match) => !CITATION_NUMBERS.test(match[1] ?? ""))
      .map((match) => ({ start: text.start + match.index, end: text.start + match.index + match[0].length })),
  );

const emptyLinks = (doc: ProseDocument, markup: Markup): Finding[] =>
  markup.links.filter((link) => link.destination.trim() === "").map((link) => findingAt(doc, link, { link: quoteOf(doc.source, link) }, "empty"));

const missingAnchors = (doc: ProseDocument, markup: Markup): Finding[] => {
  const keys = anchorKeys(markup);
  return markup.links
    .filter((link) => link.destination.startsWith("#") && !reachesAnchor(link.destination, keys))
    .map((link) => findingAt(doc, link, { link: quoteOf(doc.source, link), target: link.destination }, "anchor"));
};

export const brokenLink: Detector = (doc): Finding[] => {
  const markup = markupOf(doc);
  if (markup === undefined) return [];
  const references = unresolvedReferences(doc.source, markup).map((span) => findingAt(doc, span, { link: quoteOf(doc.source, span) }, "reference"));
  return [...emptyLinks(doc, markup), ...missingAnchors(doc, markup), ...references].toSorted(
    (left, right) => Number(left.values["offset"]) - Number(right.values["offset"]),
  );
};
