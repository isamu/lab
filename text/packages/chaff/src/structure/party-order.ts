import type { BodyText } from "./definition-use.ts";

/**
 * 当事者の呼び名を並べた所（甲及び乙、甲又は乙、甲乙、甲、乙及び丙）と、文書がふだん書く順と逆に並べた所。
 * 並べる語は言語パッケージの語彙表から取る。向きのある言い方（乙から甲へ、甲が乙に）は並べる語でつながないので読まない。
 */
export type ListingWords = {
  /** 当事者の呼び名（甲、乙、文書が定めた委託者）。 */
  readonly labels: readonly string[];
  /** 間に語を置かずに並べてよい呼び名（甲乙）。 */
  readonly bareLabels: readonly string[];
  /** 並べる語（及び、又は、・）。 */
  readonly joiners: readonly string[];
  /** 同じ並びのあとに並べる語があるときだけつなぐ印（甲、乙及び丙の「、」）。 */
  readonly seriesMarks: readonly string[];
};

export type PartyListing = { readonly start: number; readonly end: number; readonly labels: readonly string[] };

export type OrderSlip = { readonly listing: PartyListing; readonly usual: PartyListing; readonly usualCount: number; readonly reverseCount: number };

type Link = "joiner" | "series" | "bare";
type Step = { readonly link: Link; readonly label: string; readonly end: number };

/** 呼び名の前の一字がこれなら、呼び名は長い語の一部（乙種の前の語、1丁目）。 */
const WORD_CHAR = /[\p{Script=Han}\p{Script=Katakana}\p{Script=Latin}\p{N}ー]/u;

const longestAt = (text: string, at: number, words: readonly string[]): string | undefined =>
  words
    .filter((word) => word !== "" && text.startsWith(word, at))
    .reduce<string | undefined>((best, word) => (best === undefined || word.length > best.length ? word : best), undefined);

const stepAfter = (text: string, at: number, previous: string, words: ListingWords): Step | undefined => {
  const linked = (link: Link, mark: string | undefined): Step | undefined => {
    if (mark === undefined) return undefined;
    const label = longestAt(text, at + mark.length, words.labels);
    return label === undefined ? undefined : { link, label, end: at + mark.length + label.length };
  };
  const bare = words.bareLabels.includes(previous) ? longestAt(text, at, words.bareLabels) : undefined;
  const side: Step | undefined = bare === undefined ? undefined : { link: "bare", label: bare, end: at + bare.length };
  return linked("joiner", longestAt(text, at, words.joiners)) ?? linked("series", longestAt(text, at, words.seriesMarks)) ?? side;
};

/** 並べた語の数。「、」は、そのあとに並べる語が無ければ並びの終わり（「甲、乙は」は並べたと読まない）。 */
const linksKept = (links: readonly Link[]): number => {
  const lastJoiner = links.lastIndexOf("joiner");
  const series = links.findIndex((link, index) => link === "series" && index > lastJoiner);
  return series === -1 ? links.length : series;
};

/** 最後の呼び名が長い語の頭なら並びに入れない（乙及び甲種株式の甲）。間を置かずに並べた甲乙は、あとに語が続いてよい（甲乙間、甲乙双方）。 */
const endsInWord = (text: string, steps: readonly Step[]): boolean => {
  const last = steps.at(-1);
  return last !== undefined && last.link !== "bare" && WORD_CHAR.test(text.charAt(last.end));
};

const listingAt = (text: BodyText, at: number, first: string, words: ListingWords): PartyListing => {
  const steps: Step[] = [];
  let end = at + first.length;
  for (let step = stepAfter(text.text, end, first, words); step !== undefined; step = stepAfter(text.text, end, step.label, words)) {
    steps.push(step);
    end = step.end;
  }
  const whole = endsInWord(text.text, steps) ? steps.slice(0, -1) : steps;
  const kept = whole.slice(0, linksKept(whole.map((step) => step.link)));
  const last = kept.at(-1);
  return { start: text.start + at, end: text.start + (last === undefined ? at + first.length : last.end), labels: [first, ...kept.map((step) => step.label)] };
};

/** 一つの文の中の並び。呼び名が二つ以上で、違う呼び名を並べたものだけ。 */
const listingsIn = (text: BodyText, words: ListingWords): PartyListing[] => {
  const found: PartyListing[] = [];
  let at = 0;
  while (at < text.text.length) {
    const first = WORD_CHAR.test(text.text.charAt(at - 1)) ? undefined : longestAt(text.text, at, words.labels);
    const listing = first === undefined ? undefined : listingAt(text, at, first, words);
    if (listing !== undefined && new Set(listing.labels).size > 1) found.push(listing);
    at = listing !== undefined && listing.labels.length > 1 ? listing.end - text.start : at + 1;
  }
  return found;
};

export const partyListings = (texts: readonly BodyText[], words: ListingWords): PartyListing[] => texts.flatMap((text) => listingsIn(text, words));

const pairsOf = (labels: readonly string[]): [string, string][] =>
  labels.flatMap((first, index) => labels.slice(index + 1).flatMap((second): [string, string][] => (second === first ? [] : [[first, second]])));

const keyOf = (left: string, right: string): string => `${left}\u0000${right}`;

const byPair = (listings: readonly PartyListing[]): Map<string, PartyListing[]> => {
  const pairs = new Map<string, PartyListing[]>();
  listings.forEach((listing) =>
    new Set(pairsOf(listing.labels).map(([first, second]) => keyOf(first, second))).forEach((key) => pairs.set(key, [...(pairs.get(key) ?? []), listing])),
  );
  return pairs;
};

/**
 * 文書がふだん書く順と逆に並べた所。ふだんの順は、同じ二つの呼び名を並べた所の多い方で、逆の順の minRatio 倍以上あるときだけ
 * 決まる（同じ数なら、どちらとも言えないので指さない）。
 */
export const reversedListings = (listings: readonly PartyListing[], minRatio: number): OrderSlip[] => {
  const pairs = byPair(listings);
  return listings.flatMap((listing) => {
    const slips = pairsOf(listing.labels).flatMap(([first, second]): OrderSlip[] => {
      const reverse = pairs.get(keyOf(first, second)) ?? [];
      const usual = pairs.get(keyOf(second, first)) ?? [];
      const example = usual[0];
      return example === undefined || usual.length < minRatio * reverse.length
        ? []
        : [{ listing, usual: example, usualCount: usual.length, reverseCount: reverse.length }];
    });
    return slips.slice(0, 1);
  });
};
