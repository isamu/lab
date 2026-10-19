// A ladder of grades written as one letter repeated (A, AA, AAA; B, BB, BBB): conformance levels, ratings. Pure.

/**
 * Two rungs of one letter side by side, joined by a mark or one short word (A and AA, AA or AAA, AA/AAA, BBB to BB). The
 * ladder tells the reader that the letters are grades; one rung alone (AA, AAA) can be an acronym and is not read so.
 */
const EDGE_BEFORE = String.raw`(?<![\p{L}\p{N}_&])`;
const EDGE_AFTER = String.raw`(?![\p{L}\p{N}_&])`;
/** A mark (A/AA, A, AA) or one short word (A and AA, AA or AAA) between the rungs. */
const JOINER = String.raw`(?:[ \t]*[,/–-][ \t]*|[ \t]+\p{Ll}{2,3}[ \t]+)`;
const RUNGS = new RegExp(
  String.raw`${EDGE_BEFORE}(?<first>(?<letter>[A-Z])\k<letter>{0,2})${EDGE_AFTER}${JOINER}(?<second>\k<letter>{1,3})${EDGE_AFTER}`,
  "gu",
);
const MAX_RUNG = 3;

/** The repeated-letter words (AA, AAA) of every ladder the text writes. A ladder anywhere makes its rungs known everywhere. */
export const gradeLadderWords = (source: string): string[] =>
  [...source.matchAll(RUNGS)].flatMap((match) => {
    const { first = "", second = "", letter = "" } = match.groups ?? {};
    if (first.length === second.length) return [];
    return Array.from({ length: MAX_RUNG - 1 }, (_, index) => letter.repeat(index + 2));
  });
