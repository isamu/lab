// A dash with space on both sides after the last comma before an and / or ("Washington, DC – The Cybersecurity and
// Infrastructure Security Agency"). The dash closes off what came before it, a dateline here, so the commas before it
// do not separate the items of a list the and / or ends. Commas and dashes inside brackets or quotation marks are not
// the and / or's own. Pure, and one pass over the sentence.
import type { Token } from "../plugin.ts";

const DASHES = new Set(["–", "—", "―", "-", "--"]);
const OPENERS = new Set(["(", "[", "{", "“"]);
const CLOSERS = new Set([")", "]", "}", "”"]);
const SPACE = /\s/u;

const isSpacedDash = (token: Token, source: string): boolean =>
  DASHES.has(token.surface) && SPACE.test(source.charAt(token.span.start - 1)) && SPACE.test(source.charAt(token.span.end));

/** The last comma and the last spaced dash seen at one depth of brackets. */
type Seen = { comma: number; dash: number };

type Scan = { depth: number; readonly seen: Seen[]; readonly breaks: boolean[] };

const seenAt = (scan: Scan): Seen => {
  const seen = scan.seen[scan.depth] ?? { comma: -1, dash: -1 };
  scan.seen[scan.depth] = seen;
  return seen;
};

/**
 * For each token, whether a spaced dash comes between the last comma before it and it, at its depth, and not right
 * before it: a dash right before the and / or sets off its last item (the plan, the budget – and the schedule).
 */
export const dashBreaks = (tokens: readonly Token[], source: string): boolean[] =>
  tokens.reduce<Scan>(
    (scan, token, at) => {
      if (CLOSERS.has(token.surface)) {
        scan.seen.length = scan.depth;
        scan.depth = Math.max(0, scan.depth - 1);
      }
      const seen = seenAt(scan);
      scan.breaks.push(seen.comma !== -1 && seen.dash > seen.comma && seen.dash < at - 1);
      if (token.surface === ",") seen.comma = at;
      if (isSpacedDash(token, source)) seen.dash = at;
      if (OPENERS.has(token.surface)) scan.depth += 1;
      return scan;
    },
    { depth: 0, seen: [], breaks: [] },
  ).breaks;
