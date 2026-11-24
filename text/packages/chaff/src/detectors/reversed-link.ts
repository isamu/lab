// A Markdown link written the wrong way round, `(text)[address]`: Markdown makes no link of it and shows the brackets
// and the address as they are. Pure; reads the text the reader sees.
import type { Detector, Finding } from "../plugin.ts";
import { findingAt, markupOf } from "./markup-finding.ts";

/**
 * Round brackets right before square ones, as `[text](address)` reversed. A `\` or a `]` before the `(` is not
 * the start of one, and a `^` after the `[` is a note mark (`(see)[^1]`).
 */
const ROUND_THEN_SQUARE = /(?<![\\\]])\(([^()\n]+)\)\[([^[\]\s^][^[\]\s]*)\]/gu;

/**
 * What the square brackets hold must be an address, or `(1)[2]` and `(Smith 2020)[3]` would count: a scheme
 * (`https://`, `mailto:`), `www.`, a path (`/`, `./`, `../`), an anchor (`#setup`), or a page (`setup.md`).
 */
const ADDRESSES: readonly RegExp[] = [
  /^[a-z][a-z0-9+.-]*:\/\/\S+$/iu,
  /^(?:mailto:|www\.|#)\S+$/iu,
  /^\.{0,2}\/\S*$/u,
  /^\S+\.(?:md|mdx|html?|pdf)(?:#\S*)?$/iu,
];

const isAddress = (written: string): boolean => ADDRESSES.some((address) => address.test(written));

const IMAGE_MARK = "!";

export const reversedLink: Detector = (doc): Finding[] => {
  const markup = markupOf(doc);
  if (markup === undefined) return [];
  return markup.texts.flatMap((text) =>
    [...doc.source.slice(text.start, text.end).matchAll(ROUND_THEN_SQUARE)]
      .filter((match) => isAddress(match[2] ?? ""))
      .map((match) => {
        const start = text.start + match.index;
        const span = { start: doc.source.charAt(start - 1) === IMAGE_MARK ? start - 1 : start, end: start + match[0].length };
        return findingAt(doc, span, { text: match[1] ?? "", url: match[2] ?? "" });
      }),
  );
};
