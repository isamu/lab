import type { Mention } from "../plugin.ts";

/**
 * 条を書かない番地を読むときに引く、同じ行の既知の参照。before（名指しの参照）に、見つけた番地を順に足していく。
 * 引くたびに全部をなめると、参照の数の二乗になる。before は並べ替えて二分探索で、足したものは深さごとに最後の一つで引く。
 *
 * 足すものは、正規表現で左から見つけた番地の順に来る。だから足したものの終わりは、次に引く位置より前にあり、並びの順に増える。
 * - overlaps: [start, end) と重なるものがあるか。足したものは引く位置より前で終わるので、重ならない。
 * - previous: 終わりが at 以前で、終わりの深さが depth のもののうち、終わりが最も後ろのもの。同じ終わりなら後から知ったもの。
 * - endingAt: 終わりが at のもののうち、最初に知ったもの。
 */
export type KnownMentions = {
  readonly overlaps: (start: number, end: number) => boolean;
  readonly previous: (at: number, depth: number) => Mention | undefined;
  readonly endingAt: (at: number) => Mention | undefined;
  readonly add: (mention: Mention, depth: number) => void;
};

/** sorted の中で、pass が偽になる最初の位置。pass は先頭から真が続き、あとは偽。 */
const firstFailing = <T>(sorted: readonly T[], pass: (item: T) => boolean): number => {
  let [low, high] = [0, sorted.length];
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    const item = sorted[middle];
    if (item !== undefined && pass(item)) low = middle + 1;
    else high = middle;
  }
  return low;
};

/** 始まりの順に並べ、そこまでの終わりの最大を添える。始まりが end より前のものの、終わりの最大が start より後ろなら重なる。 */
const overlapIndex = (before: readonly Mention[]): ((start: number, end: number) => boolean) => {
  const byStart = before.filter((mention) => !Number.isNaN(mention.start)).toSorted((left, right) => left.start - right.start);
  let reach = -Infinity;
  const reaches = byStart.map((mention) => {
    reach = Math.max(reach, Number.isNaN(mention.end) ? -Infinity : mention.end);
    return reach;
  });
  return (start, end) => {
    const count = firstFailing(byStart, (mention) => mention.start < end);
    return count > 0 && (reaches[count - 1] ?? -Infinity) > start;
  };
};

type Ranked = { readonly mention: Mention; readonly order: number };

const byEndThenOrder = (left: Ranked, right: Ranked): number => {
  if (left.mention.end !== right.mention.end) return left.mention.end < right.mention.end ? -1 : 1;
  return left.order - right.order;
};

/** 深さごとに、終わりの順（同じなら知った順）に並べる。 */
const previousIndex = (before: readonly Mention[], depthOf: (at: number) => number): ((at: number, depth: number) => Mention | undefined) => {
  const byDepth = new Map<number, Ranked[]>();
  before.forEach((mention, order) => {
    if (Number.isNaN(mention.end)) return;
    const depth = depthOf(mention.end);
    const ranked = byDepth.get(depth) ?? [];
    ranked.push({ mention, order });
    byDepth.set(depth, ranked);
  });
  const sorted = new Map([...byDepth].map(([depth, ranked]) => [depth, ranked.toSorted(byEndThenOrder)]));
  return (at, depth) => {
    const ranked = sorted.get(depth) ?? [];
    return ranked[firstFailing(ranked, (entry) => entry.mention.end <= at) - 1]?.mention;
  };
};

const firstByEnd = (mentions: readonly Mention[]): Map<number, Mention> => {
  const found = new Map<number, Mention>();
  mentions.forEach((mention) => {
    if (!found.has(mention.end)) found.set(mention.end, mention);
  });
  return found;
};

export const knownMentions = (before: readonly Mention[], depthOf: (at: number) => number): KnownMentions => {
  const overlapsBefore = overlapIndex(before);
  const previousBefore = previousIndex(before, depthOf);
  const endsBefore = firstByEnd(before);
  const lastAddedByDepth = new Map<number, Mention>();
  const endsAdded = new Map<number, Mention>();
  return {
    overlaps: overlapsBefore,
    previous: (at, depth) => {
      const known = previousBefore(at, depth);
      const added = lastAddedByDepth.get(depth);
      return added !== undefined && (known === undefined || added.end >= known.end) ? added : known;
    },
    endingAt: (at) => endsBefore.get(at) ?? endsAdded.get(at),
    add: (mention, depth) => {
      lastAddedByDepth.set(depth, mention);
      if (!endsAdded.has(mention.end)) endsAdded.set(mention.end, mention);
    },
  };
};
