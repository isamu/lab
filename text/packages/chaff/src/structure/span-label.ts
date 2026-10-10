import { leadOf } from "./stated-period.ts";

const LABEL_COLON = /[:：]/u;
const LABEL_CLOSE = /(?:\*\*|__|】|\])$/u;
/** 見出しの語は数語（Sales period）。コロンの前がそれより長ければ文で、見出しではない。 */
const MAX_LABEL_WORDS = 4;

/** 期間を名指す語（period、dates）で終わる短い見出しとコロン（Sales period:）の後ろの、行の中の位置。そうした見出しの無い行は undefined。 */
export const afterSpanLabel = (line: string, heads: readonly string[]): number | undefined => {
  const lead = leadOf(line);
  const colon = line.slice(lead).search(LABEL_COLON);
  if (colon === -1) return undefined;
  const label = line
    .slice(lead, lead + colon)
    .replace(LABEL_CLOSE, "")
    .trim()
    .toLowerCase()
    .split(/\s+/u);
  if (label.length > MAX_LABEL_WORDS) return undefined;
  const text = label.join(" ");
  const named = heads.some((head) => {
    const word = head.toLowerCase();
    return text === word || text.endsWith(` ${word}`);
  });
  return named ? lead + colon + 1 : undefined;
};
