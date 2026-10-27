// 見出しの番号の付け方。純粋な関数だけを置く。どの語が番号を持つか（第1章、Chapter 1）と、番号を付けない前後の見出し
// （目次、参考文献）は言語パッケージの語彙表が言う。

/** 番号の無い見出しの書き方。ほかの書き方は "dot"（1.）や "label:章"（第1章）のように、番号を持つ語ごとに分ける。 */
export const UNNUMBERED = "none";

/** 番号を持つ語。before は語が番号の前（Chapter 1、ステップ1）、after は番号の後ろ（第1章、1章）。 */
export type NumberLabel = { readonly word: string; readonly position: "before" | "after" };

const ARABIC = "[0-9０-９]+";
const KANJI = "[一二三四五六七八九十百]+";
const ROMAN = "[IVXⅠ-Ⅻ]+";

/**
 * 番号の後ろに続く見出しの言葉の頭。字か、コードや引用の開き（`check()`、「概要」）か、字の付いた数（「5. 11月の取り組み」の 11月）で始まる。
 * 「8.2.3 (2026-08-06)」の版や「3 reasons」の数量は番号と読まない。
 */
const WORDS_FOLLOW = '(?=\\s*(?:[\\p{L}`「『“"]|[0-9０-９]+\\p{L}))';

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

type NumberMark = { readonly style: string; readonly mark: string };

const markOf = (heading: string, labels: readonly NumberLabel[]): NumberMark => {
  const text = heading.replace(LEAD, "");
  const label = labels.find((candidate) => labelPattern(candidate).test(text));
  if (label !== undefined) return { style: `label:${label.word.toLowerCase()}`, mark: labelPattern(label).exec(text)?.[0] ?? "" };
  const shape = SHAPES.find(([, pattern]) => pattern.test(text));
  return shape === undefined ? { style: UNNUMBERED, mark: "" } : { style: shape[0], mark: shape[1].exec(text)?.[0] ?? "" };
};

/** 見出しの言葉から、番号の書き方を読む。番号を持つ語（第1章）を先に、字だけの形（1.）を後に見る。 */
export const numberingStyleOf = (heading: string, labels: readonly NumberLabel[]): string => markOf(heading, labels).style;

/** 見出しの番号の印そのもの（「Q. 」の Q.、「1. 」の 1.）。空白は除く。番号が無ければ空。 */
export const numberMarkOf = (heading: string, labels: readonly NumberLabel[]): string => markOf(heading, labels).mark.replace(/\s/gu, "");

/** 番号の中の数の一つ一つ（「7.1」の 7 と 1、「Chapter II」の II）。番号は印の最後に来るので、語の頭の大文字（Chapter の C）は最後にならない。 */
const NUMBER_TOKEN = /[0-9０-９]+|[A-ZⅠ-Ⅻ①-⑳一二三四五六七八九十百]+/gu;
const FIRST_NUMBERS: ReadonlySet<string> = new Set(["1", "１", "I", "Ⅰ", "A", "①", "一"]);

/** 番号が並びの最初（1.、1.1、第1章、A.、①）か。最後の数が最初の数のときで、番号の無い見出しは並びを始めない。 */
export const opensNumbering = (heading: string, labels: readonly NumberLabel[]): boolean => {
  const last = markOf(heading, labels).mark.match(NUMBER_TOKEN)?.at(-1);
  return last !== undefined && FIRST_NUMBERS.has(last);
};

/**
 * 見出し 1 つ。depth は深さ（#の数）、style は番号の書き方、skipped は番号を付けない前後の見出し（目次・参考文献）、opens は番号が 1 から始まるか。
 * mark は番号の印そのもの（Q.）で、無ければ字の番号を並びとして読む。
 */
export type NumberedHeading = { readonly depth: number; readonly style: string; readonly skipped: boolean; readonly opens: boolean; readonly mark?: string };

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

/** 番号付きの兄弟がこれだけあり、最初の番号が 1 のときだけ、番号の無い兄弟を並びの外と読む。 */
const MIN_NUMBERED_RUN = 2;

/**
 * 1 から始まる番号の並びの前と後ろの、番号の無い兄弟（文書の題、「Applies to England」、締めの「まとめ」「Still not working?」）は並びの外。
 * 並びの途中の番号の無い見出しだけが、番号を落とした見出しと読める。
 */
const outsideTheRun = (members: readonly number[], headings: readonly NumberedHeading[]): ReadonlySet<number> => {
  const numbered = members.filter((at) => (headings[at]?.style ?? UNNUMBERED) !== UNNUMBERED);
  const first = numbered[0];
  const last = numbered.at(-1);
  if (first === undefined || last === undefined || numbered.length < MIN_NUMBERED_RUN || headings[first]?.opens !== true) return new Set();
  return new Set(members.filter((at) => at < first || at > last));
};

/** 同じ字を付けた兄弟がこれだけあれば、その字は番号でなく印。 */
const MIN_REPEATED_LETTERS = 2;

/**
 * 兄弟が字の番号にみな同じ字を付けている（「Q. 〜」「Q. 〜」）なら、その字は並びの番号でなく質問の印。番号の無い見出しと読む。
 * 番号なら字は進む（A. B. C.）。
 */
const prefixLetters = (members: readonly number[], headings: readonly NumberedHeading[]): ReadonlySet<number> => {
  const letters = members.filter((at) => headings[at]?.style === "letter");
  const marks = new Set(letters.map((at) => headings[at]?.mark));
  return letters.length >= MIN_REPEATED_LETTERS && marks.size === 1 && !marks.has(undefined) ? new Set(letters) : new Set();
};

/** 番号の段（「1.」は 1 段、「1.1」は 2 段）。番号の中の算用数字の数で、数の無い番号（A.、第一章）は 1 段。 */
const ARABIC_RUN = /[0-9０-９]+/gu;
const levelOf = (heading: NumberedHeading | undefined): number => Math.max(1, heading?.mark?.match(ARABIC_RUN)?.length ?? 0);

/** 兄弟の中で 1 からこれだけ始め直す書き方は、別の書き方の番号の下の小見出しの番号（「1.」の下の「(1)」「(2)」、「2.」の下でまた「(1)」）。 */
const MIN_RESTARTS = 2;

const restartingStyles = (numbered: readonly number[], headings: readonly NumberedHeading[], styleOf: (at: number) => string): ReadonlySet<string> => {
  const restarts = new Map<string, number>();
  numbered.filter((at) => headings[at]?.opens === true).forEach((at) => restarts.set(styleOf(at), (restarts.get(styleOf(at)) ?? 0) + 1));
  return new Set([...restarts].filter(([, count]) => count >= MIN_RESTARTS).map(([style]) => style));
};

/**
 * 番号の書き方を比べる組。ページが段の違う番号（「1.」と「1.1」、「1.」と「(1)」）を同じ深さの見出しにしたときは、段ごとに分けて比べる。
 * 段は番号の数の数（1.1 は 2 段）と、兄弟の中で 1 から始め直す書き方（小見出しの番号）で見分ける。
 */
const styleGroups = (numbered: readonly number[], headings: readonly NumberedHeading[], styleOf: (at: number) => string): number[][] => {
  const nested = restartingStyles(numbered, headings, styleOf);
  const compared = nested.size === new Set(numbered.map(styleOf)).size ? numbered : numbered.filter((at) => !nested.has(styleOf(at)));
  const levels = new Map<number, number[]>();
  compared.forEach((at) => levels.set(levelOf(headings[at]), [...(levels.get(levelOf(headings[at])) ?? []), at]));
  return [...levels.values()];
};

/**
 * 兄弟の見出しのうち、少ないほうの書き方のもの。先に番号の有無を比べ（「1. 概要」「2. 手順」「まとめ」の「まとめ」）、
 * 番号の付いた見出しのあいだで、段ごとに書き方を比べる（「1.」「2.」「3）」の「3）」）。同じ数なら言わない（二つだけの兄弟は必ず同じ数か一つの書き方）。
 * 前後の見出し（目次・参考文献）と、1 から始まる番号の並びの前と後ろの見出しは数えない。
 */
export const numberingMinorities = (headings: readonly NumberedHeading[]): NumberingMinority[] =>
  siblingGroups(headings).flatMap((group) => {
    const listed = group.filter((at) => headings[at]?.skipped !== true);
    const outside = outsideTheRun(listed, headings);
    const members = listed.filter((at) => !outside.has(at));
    const prefixed = prefixLetters(members, headings);
    const styleOf = (at: number): string => (prefixed.has(at) ? UNNUMBERED : (headings[at]?.style ?? UNNUMBERED));
    const numbered = members.filter((at) => styleOf(at) !== UNNUMBERED);
    return [
      ...minoritiesOf(
        minorityBy(members, (at) => (styleOf(at) === UNNUMBERED ? UNNUMBERED : "numbered")),
        "numbered",
      ),
      ...styleGroups(numbered, headings, styleOf).flatMap((level) => minoritiesOf(minorityBy(level, styleOf), "style")),
    ];
  });
