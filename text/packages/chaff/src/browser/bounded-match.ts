import type { TextMatches } from "../custom/pattern-timeout.ts";

// custom/bounded-match.ts in a browser, which has no vm to stop a pattern: the same matches, without the time limit.
// regex-safety.ts still refuses the shapes known to run away before a pattern is used.

export const boundedMatches = (source: string, flags: string, texts: readonly string[]): TextMatches =>
  texts.map((text) =>
    [...text.matchAll(new RegExp(source, `g${flags}`))].filter((match) => match[0] !== "").map((match) => ({ index: match.index, text: match[0] })),
  );
