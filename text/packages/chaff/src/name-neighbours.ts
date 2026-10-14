import type { NameMention } from "./name-variants.ts";

// 解析器が名前の一語を名前と読まなかった所を、隣の語と合わせて名前の現れにする（to Rachel Whitford の Rachel）。

/** 隣の語を探す範囲（UTF-16 の単位）。 */
const NEIGHBOUR_LOOKBACK = 40;
/** 隣の語の外側の記号（(Rachel、Floyd.）。名前の側の記号（Rachel, Whitford の ,）は語を切るので残す。 */
const MARK = /\p{P}/u;
const withoutLeadingMarks = (word: string): string => {
  const chars = [...word];
  const start = chars.findIndex((char) => !MARK.test(char));
  return start < 0 ? "" : chars.slice(start).join("");
};
const withoutTrailingMarks = (word: string): string => {
  const chars = [...word];
  return chars.slice(0, chars.findLastIndex((char) => !MARK.test(char)) + 1).join("");
};

const wordBeforeAt = (source: string, offset: number): string | undefined => {
  if (source.charAt(offset - 1) !== " ") return undefined;
  const from = Math.max(0, offset - 1 - NEIGHBOUR_LOOKBACK);
  const parts = source.slice(from, offset - 1).split(/\s/u);
  const word = withoutLeadingMarks(parts.at(-1) ?? "");
  return word === "" || (from > 0 && parts.length === 1) ? undefined : word;
};

const wordAfterAt = (source: string, end: number): string | undefined => {
  if (source.charAt(end) !== " ") return undefined;
  const word = withoutTrailingMarks(source.slice(end + 1, end + 1 + NEIGHBOUR_LOOKBACK).split(/\s/u)[0] ?? "");
  return word === "" ? undefined : word;
};

/**
 * 解析器が名前の一語を名前と読まなかった所（to Rachel Whitford の Rachel を動詞と読む）。空白一つで隣の語と合わせた形を、ほかの所で
 * 名前と読めていれば、その形の現れと見る。隣の語がほかの名前の現れに入るなら合わせない。
 */
export const withKnownNeighbours = (mentions: readonly NameMention[], source: string): NameMention[] => {
  const known = new Set(mentions.filter((mention) => mention.words.length >= 2).map((mention) => mention.surface));
  const taken = (start: number, end: number): boolean => mentions.some((mention) => mention.offset < end && start < mention.offset + mention.surface.length);
  return mentions.map((mention) => {
    const end = mention.offset + mention.surface.length;
    const before = wordBeforeAt(source, mention.offset);
    const after = wordAfterAt(source, end);
    if (before !== undefined && known.has(`${before} ${mention.surface}`) && !taken(mention.offset - 1 - before.length, mention.offset - 1)) {
      return {
        ...mention,
        surface: `${before} ${mention.surface}`,
        offset: mention.offset - 1 - before.length,
        reading: undefined,
        givenNameReading: undefined,
        words: [before, ...mention.words],
      };
    }
    if (after !== undefined && known.has(`${mention.surface} ${after}`) && !taken(end + 1, end + 1 + after.length)) {
      return { ...mention, surface: `${mention.surface} ${after}`, reading: undefined, givenNameReading: undefined, words: [...mention.words, after] };
    }
    return mention;
  });
};
