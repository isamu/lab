// 見出しの番号の付け方。純粋な関数だけを置く。どの語が番号を持つか（第1章、Chapter 1）と、番号を付けない前後の見出し
// （目次、参考文献）は言語パッケージの語彙表が言う。

/** 番号の無い見出しの書き方。ほかの書き方は "dot"（1.）や "label:章"（第1章）のように、番号を持つ語ごとに分ける。 */
export const UNNUMBERED = "none";

/** 番号を持つ語。before は語が番号の前（Chapter 1、ステップ1）、after は番号の後ろ（第1章、1章）。 */
export type NumberLabel = { readonly word: string; readonly position: "before" | "after" };

const ARABIC = "[0-9０-９]+";
const KANJI = "[一二三四五六七八九十百]+";
const ROMAN = "[IVXⅠ-Ⅻ]+";

/** 番号の後ろに続く見出しの言葉の頭。字か、コードや引用の開き（`check()`、「概要」）で始まる。「8.2.3 (2026-08-06)」の版や「3 reasons」の数量は番号と読まない。 */
const WORDS_FOLLOW = '(?=\\s*[\\p{L}`「『“"])';

/**
 * 字だけで決まる書き方。上から順に試す。ラテン文字一字とローマ数字（A. と II.）は同じ書き方とする。どちらも番号の後ろに言葉が続くときだけ。
 * 区切りの記号の無い数（「1 Introduction」）は数量（「10 reasons」）と見分けられないので読まない。
 */
const SHAPES: ReadonlyArray<readonly [string, RegExp]> = [
  ["paren", /^[(（][0-9０-９]+[)）]/u],
  ["close-paren", /^[0-9０-９]+[)）]/u],
  ["dot", new RegExp(`^${ARABIC}[a-z]?(?:[.．]${ARABIC})*[.．](?![0-9０-９])${WORDS_FOLLOW}`, "u")],
  ["dotted", new RegExp(`^${ARABIC}(?:[.．]${ARABIC})+\\s${WORDS_FOLLOW}`, "u")],
  ["circled", /^[①-⑳]/u],
  ["kanji", /^[一二三四五六七八九十]+[、.．]/u],
  ["letter", /^(?:[IVX]+|[A-Z])[.)]\s+(?=\p{L})/u],
];

const escaped = (word: string): string => word.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

/** 番号を持つ語は書いたとおりか、全部大文字で照らす（Chapter と CHAPTER。小文字の section は本文の語）。 */
const casings = (word: string): string => [...new Set([word, word.toUpperCase()])].map(escaped).join("|");

const labelPattern = (label: NumberLabel): RegExp =>
  label.position === "before"
    ? new RegExp(`^(?:${casings(label.word)})(?:\\s*(?:${ARABIC}|${KANJI}|${ROMAN})|\\s+[A-Z])(?![A-Za-z])`, "u")
    : new RegExp(`^(?:第(?:${ARABIC}|${KANJI}|${ROMAN})|${ARABIC})${escaped(label.word)}`, "u");

/** 見出しの頭の強調の印と空白。「**1. 概要**」も「1. 概要」と読む。 */
const LEAD = /^[\s*_]+/u;

/** 見出しの言葉から、番号の書き方を読む。番号を持つ語（第1章）を先に、字だけの形（1.）を後に見る。 */
export const numberingStyleOf = (heading: string, labels: readonly NumberLabel[]): string => {
  const text = heading.replace(LEAD, "");
  const label = labels.find((candidate) => labelPattern(candidate).test(text));
  if (label !== undefined) return `label:${label.word.toLowerCase()}`;
  return SHAPES.find(([, shape]) => shape.test(text))?.[0] ?? UNNUMBERED;
};

/** 見出し 1 つ。depth は深さ（#の数）、style は番号の書き方、skipped は番号を付けない前後の見出し（目次・参考文献）。 */
export type NumberedHeading = { readonly depth: number; readonly style: string; readonly skipped: boolean };

/** 親（直前の浅い見出し）と深さが同じ見出しの組。番号は兄弟の見出しのあいだで揃える。位置は渡した並びの添え字。 */
export const siblingGroups = (headings: readonly NumberedHeading[]): number[][] => {
  const parents = headings.map((heading, at) => headings.slice(0, at).findLastIndex((before) => before.depth < heading.depth));
  const groups = new Map<string, number[]>();
  headings.forEach((heading, at) => {
    const key = `${String(parents[at])}:${String(heading.depth)}`;
    groups.set(key, [...(groups.get(key) ?? []), at]);
  });
  return [...groups.values()];
};

/** 指す見出しと、何に対して少ないか。kind は numbered（番号の有無）か style（番号の書き方）。majority は多いほうの書き方で、count はその数。 */
export type NumberingMinority = {
  readonly at: number;
  readonly kind: "numbered" | "style";
  readonly majority: string;
  readonly count: number;
  /** 多いほうの書き方の、最初の兄弟の位置。指摘が例に引く。 */
  readonly example: number;
};

type Split = { readonly minority: readonly number[]; readonly majority: string; readonly count: number; readonly example: number };

const minorityBy = (members: readonly number[], keyOf: (at: number) => string): Split | undefined => {
  const counts = new Map<string, number>();
  members.forEach((at) => counts.set(keyOf(at), (counts.get(keyOf(at)) ?? 0) + 1));
  const [top, second] = [...counts].toSorted((left, right) => right[1] - left[1]);
  if (top === undefined || second === undefined || top[1] === second[1]) return undefined;
  const example = members.find((at) => keyOf(at) === top[0]) ?? -1;
  return { minority: members.filter((at) => keyOf(at) !== top[0]), majority: top[0], count: top[1], example };
};

const minoritiesOf = (split: Split | undefined, kind: NumberingMinority["kind"]): NumberingMinority[] =>
  split === undefined ? [] : split.minority.map((at) => ({ at, kind, majority: split.majority, count: split.count, example: split.example }));

/**
 * 兄弟の見出しのうち、少ないほうの書き方のもの。先に番号の有無を比べ（「1. 概要」「2. 手順」「まとめ」の「まとめ」）、
 * 番号の付いた見出しのあいだで書き方を比べる（「1.」「2.」「3）」の「3）」）。同じ数なら言わない（二つだけの兄弟は必ず同じ数か一つの書き方）。前後の見出し（目次・参考文献）は数えない。
 */
export const numberingMinorities = (headings: readonly NumberedHeading[]): NumberingMinority[] =>
  siblingGroups(headings).flatMap((group) => {
    const members = group.filter((at) => headings[at]?.skipped !== true);
    const styleOf = (at: number): string => headings[at]?.style ?? UNNUMBERED;
    const numbered = members.filter((at) => styleOf(at) !== UNNUMBERED);
    return [
      ...minoritiesOf(
        minorityBy(members, (at) => (styleOf(at) === UNNUMBERED ? UNNUMBERED : "numbered")),
        "numbered",
      ),
      ...minoritiesOf(minorityBy(numbered, styleOf), "style"),
    ];
  });
