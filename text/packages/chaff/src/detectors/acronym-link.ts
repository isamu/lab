/**
 * 外のページへのリンクを 1 行に 1 つ並べた一覧（参考の一覧、謝辞）の、リンクの文字。リンク先のページの題名
 * （- [NASA Fprime AI Policy](https://…)、- [User Timing API - Web APIs | MDN](https://…)）で、書き手が展開を書き足せない。
 * 文の中のリンク（following [NIST SP 800-61](https://…), as …）は書き手の言葉なので、略語をそのまま数える。
 * 文書の中や手元のファイルへのリンク（[README](./README.md)）も題名ではない。
 */

type Span = { readonly start: number; readonly end: number };

const EXTERNAL = /^<?https?:\/\//iu;
const TEXT_END = "](";
/** リンクの前に書いてよいもの: 行頭の空白と、箇条書きの印。 */
const LINE_HEAD = /^[ \t]*(?:(?:[-*+]|\d+[.)])[ \t]+)?$/u;
/** リンクの後ろに書いてよいもの: 行末までの空白と句読点。 */
const LINE_TAIL = /^[ \t.,;。、]*(?:\n|$)/u;

/** リンクの文字の範囲。[文字](行き先) の形で、行き先が外のページのものだけ。 */
const externalTextOf = (source: string, link: Span): Span | undefined => {
  const written = source.slice(link.start, link.end);
  const end = written.lastIndexOf(TEXT_END);
  if (!written.startsWith("[") || end === -1 || !EXTERNAL.test(written.slice(end + TEXT_END.length))) return undefined;
  return { start: link.start + 1, end: link.start + end };
};

const standsAlone = (source: string, link: Span): boolean => {
  const lineStart = source.lastIndexOf("\n", link.start - 1) + 1;
  const lineEnd = source.indexOf("\n", link.end);
  const tail = lineEnd === -1 ? source.slice(link.end) : source.slice(link.end, lineEnd + 1);
  return LINE_HEAD.test(source.slice(lineStart, link.start)) && LINE_TAIL.test(tail);
};

/** 1 行に 1 つ並べた外のページへのリンクの、文字の範囲。位置は source の上。 */
export const linkTitleSpans = (source: string, links: readonly Span[]): Span[] =>
  links.flatMap((link) => {
    const text = externalTextOf(source, link);
    return text !== undefined && standsAlone(source, link) ? [text] : [];
  });

/** 語だけの箇条書きの項目（- GPL）と、その下に入れ子にした、外のページへのリンクだけの項目（  - [GNU General Public License …](https://…)）。 */
const TERM_ITEM = /^(?<indent>[ \t]*)(?:[-*+]|\d+[.)])[ \t]+(?<term>[A-Z][A-Za-z\d&-]*[A-Z\d])[ \t]*$/u;
const LINK_ITEM = /^(?<indent>[ \t]*)(?:[-*+]|\d+[.)])[ \t]+\[(?<title>[^\]\n]+)\]\(<?https?:\/\/[^)\s]+>?\)[ \t]*$/u;
/** 題名の名前の終わり。サイトの名前を添える区切り（ | Open Source Initiative、 — CC BY 4.0）。 */
const TITLE_PART_END = /\s[|—–-]\s/u;
const CAPITALIZED = /^[A-Z]/u;

const wordsOf = (text: string): string[] => text.split(/[\s-]+/u).filter((word) => word !== "");

/** 題名が語そのものを含む（About the WTFPL、… — CC BY 4.0）か、題名の名前の大文字で始まる語の頭文字が語の字で終わる（GNU General Public License）。 */
const titleNames = (title: string, term: string): boolean => {
  const termWords = wordsOf(term.toUpperCase());
  const titleWords = wordsOf(title.toUpperCase());
  const contains = titleWords.some((_, start) => termWords.every((word, offset) => titleWords[start + offset] === word));
  const initials = wordsOf(title.split(TITLE_PART_END)[0] ?? "")
    .filter((word) => CAPITALIZED.test(word))
    .map((word) => word.charAt(0))
    .join("");
  return contains || initials.endsWith(term.replaceAll(/[&-]/gu, ""));
};

/**
 * 名前を並べた一覧で、語だけの項目のすぐ下に、その語を名指す外のページへのリンクを入れ子にした語（ライセンスの一覧の GPL、WTFPL）。
 * 語はリンク先のページの名前で、読み手はリンクから中身に行ける。題名が語を名指さないリンク（- AWS / - [Console](…)）では数えない。
 */
export const linkedListTerms = (source: string): Set<string> => {
  const lines = source.split(/\r?\n/u);
  return new Set(
    lines.flatMap((line, index) => {
      const term = TERM_ITEM.exec(line)?.groups;
      const link = LINK_ITEM.exec(lines[index + 1] ?? "")?.groups;
      if (term?.["term"] === undefined || link?.["title"] === undefined) return [];
      const nested = (link["indent"] ?? "").length > (term["indent"] ?? "").length;
      return nested && titleNames(link["title"], term["term"]) ? [term["term"]] : [];
    }),
  );
};
