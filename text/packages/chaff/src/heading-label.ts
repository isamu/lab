import type { Lexicon, NumberingContext, StructurePatterns, Token } from "./plugin.ts";
import { universalNumber } from "./structure/universal.ts";

const ON_HEADING: NumberingContext = { open: [], isHeading: true };

/** 木を組むときと同じ読み方（numbering-gap が比べる番号）で読んだ、番号の後ろの題。「第2章 概要」「Chapter 2: Setup」「1. はじめに」。 */
const numberedTitle = (heading: string, patterns: StructurePatterns): string | undefined => {
  const numbered = patterns.numbered(heading, ON_HEADING) ?? universalNumber(patterns, heading, ON_HEADING, false);
  return numbered === undefined || numbered.heading === "" ? undefined : numbered.heading;
};

const SPECIAL = /[.*+?^${}()|[\]\\]/gu;

/**
 * 番号の前に書いて名前を付ける語（語彙表 numbered-label の before: 例・問・Step）と番号と区切りで始まる見出しの、札の部分。
 * 区切りはコロンか空白。札の後ろに題が無ければ当てない。木はこの札を番号として読まない。
 */
export const labelPatternOf = (labelWords: readonly string[]): RegExp | undefined => {
  if (labelWords.length === 0) return undefined;
  const words = labelWords.map((word) => word.replace(SPECIAL, String.raw`\$&`)).join("|");
  return new RegExp(String.raw`^(?:${words})[ \t\u3000]?[0-9０-９]+(?:[.．][0-9０-９]+)*(?:[ \t\u3000]*[:：][ \t\u3000]*|[ \t\u3000]+)(?=\S)`, "u");
};

/**
 * 見出しの頭の番号の札を除いた題。札は本文で繰り返されないので、見出しと文の重なりを測るときは数えない。
 * 番号は木と同じ読み方で読み、木が読まない札（「例 3：」「Step 3:」）は語彙表の語で読む。札が無ければ見出しのまま。
 */
export const unlabeledHeading = (heading: string, patterns: StructurePatterns | undefined, labelPattern: RegExp | undefined): string => {
  const titled = patterns === undefined ? undefined : numberedTitle(heading, patterns);
  if (titled !== undefined) return titled;
  const label = labelPattern?.exec(heading)?.[0];
  return label === undefined ? heading : heading.slice(label.length);
};

/**
 * 見出しごとに、札を除いた題を読まれたときに一度だけ読む関数。読むのは heading-echo だけなので、ほかの rule には番号を読む代金を払わせない。
 * 札の語は語彙表 numbered-label の before。
 */
export const unlabeledReader = (patterns: StructurePatterns | undefined, lexicons: Readonly<Record<string, Lexicon>>): ((heading: string) => () => string) => {
  const labelWords = (lexicons["numbered-label"] ?? []).filter((entry) => entry.position === "before").map((entry) => entry.pattern);
  const labelPattern = labelPatternOf(labelWords);
  return (heading) => {
    const memo: { value?: string } = {};
    return () => (memo.value ??= unlabeledHeading(heading, patterns, labelPattern));
  };
};

/**
 * 見出しの語のうち、札より後ろ（題）のもの。tokens の位置は見出しの中の位置。札の語（例・Step）を見出しにある語と数えると、
 * 文が札の語を使っただけ（例として…）で「見出しに無い語を足していない」ことになる。
 */
export const titleTokens = (heading: string, title: string, tokens: readonly Token[]): readonly Token[] => {
  const titleStart = heading.lastIndexOf(title);
  return tokens.filter((token) => token.span.start >= titleStart);
};
