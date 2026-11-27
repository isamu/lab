// An acronym that heads a name the text spells out with its own longer acronym in brackets: XSL Transformations (XSLT),
// DNS Security Extensions (DNSSEC). The writer explains the whole name, whose acronym starts with the inner one, so the inner
// one is read as part of that name and not asked to be spelled out again. Pure.

/** The acronym, one to five capitalised words (across a line break too), then the bracketed acronym that starts with it. */
const HEAD = String.raw`(?<![\p{L}\p{N}_&])(?<head>[A-Z]{2,10})`;
const GAP = String.raw`(?:[ \t]+|[ \t]*\n[ \t]*|[-‐])`;
const WORD = String.raw`\p{Lu}\p{Ll}+`;
const WHOLE = String.raw`\s*\((?<whole>[A-Z]{2,12})s?\)`;
const NAME_HEAD = new RegExp(`${HEAD}(?:${GAP}${WORD}){1,5}${WHOLE}`, "gu");

/** The acronyms that head a name spelled out with a longer acronym starting with the same letters. */
export const nameHeadAcronyms = (body: string): Set<string> =>
  new Set(
    [...body.matchAll(NAME_HEAD)].flatMap((match) => {
      const head = match.groups?.["head"] ?? "";
      const whole = match.groups?.["whole"] ?? "";
      return whole.length > head.length && whole.startsWith(head) ? [head] : [];
    }),
  );
