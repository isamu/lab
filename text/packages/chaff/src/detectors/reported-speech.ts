// Words a particular person said on a particular occasion, quoted and then reported (業者に申し込んだら、「…」と言われています,
// 業者から「…」と言われている). The phrase that reports them names no crowd: the sayer is the one the sentence has just named,
// or the one the writer met on that occasion. The cues before the quotation come from the language's lexicon. Pure.

/** Each closing quotation mark and the mark that opens it. */
const OPENER_OF: ReadonlyMap<string, string> = new Map([
  ["」", "「"],
  ["』", "『"],
]);

/** Where the quotation that closes at the end of the text opens, or -1 when the text does not end with a quotation. */
export const quotationStart = (text: string): number => {
  const close = text.at(-1) ?? "";
  const open = OPENER_OF.get(close);
  if (open === undefined) return -1;
  const depth = { open: 0 };
  return text.split("").findLastIndex((char) => {
    if (char === close) depth.open += 1;
    else if (char === open) depth.open -= 1;
    return char === open && depth.open === 0;
  });
};

/** The cues that name the occasion or the sayer: one anywhere before the quotation (申し込んだら、), one right before it (業者から「). */
export type TellingCues = { readonly occasion: readonly string[]; readonly sayer: readonly string[] };

/**
 * Whether the words a phrase follows (`before`: the sentence up to the phrase) end with a quotation told on a named
 * occasion or by a named sayer. Without a quotation, or with one no cue names (「日本人は勤勉だ」と言われている), the
 * phrase still reports a crowd's opinion.
 */
export const followsToldQuote = (before: string, cues: TellingCues): boolean => {
  const start = quotationStart(before);
  if (start === -1) return false;
  const lead = before.slice(0, start);
  return cues.occasion.some((cue) => lead.includes(cue)) || cues.sayer.some((cue) => lead.endsWith(cue));
};
