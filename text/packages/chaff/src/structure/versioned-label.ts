/**
 * A label naming the version it is about: the version after the label and a word (End of support for 5.0.0:), or before
 * it with a word (3.0.0 のサポート終了日：). The words come from the language's lexicon; a version is digits joined by dots,
 * with or without a leading v. Pure.
 */

/** The words that join a version to a label: after for the label, word, version order; before for version, word, label. */
export type VersionWords = { readonly after: readonly string[]; readonly before: readonly string[] };

/** A list marker, a table cell's bar and emphasis before the label. A numbered marker needs its space: 3.0.0 is a version, not item 3. */
const LINE_LEAD = /^[ \t]*(?:(?:[-*+]|\d{1,3}[.)])[ \t]+)?(?:\|[ \t]*)?[*_]*/u;
const VERSION = /^v?\d+(?:\.\d+)+/iu;
/** After the label's version, only the label's end: a colon or a table cell's bar. */
const VERSION_END = /^[ \t]*[:：|]/u;
const SPACES = /^[ \t\u3000]*/u;

const spacesAt = (text: string): number => SPACES.exec(text)?.[0].length ?? 0;

const versionAt = (text: string): number => VERSION.exec(text)?.[0].length ?? 0;

/** After the label: one word, spaces on both sides, a version and the label's end. Returns the label's end on. */
const afterVersion = (rest: string, word: string): string | undefined => {
  const gap = spacesAt(rest);
  if (gap === 0 || !rest.slice(gap).toLowerCase().startsWith(`${word.toLowerCase()} `)) return undefined;
  const from = gap + word.length + spacesAt(rest.slice(gap + word.length));
  const version = versionAt(rest.slice(from));
  const tail = rest.slice(from + version);
  return version > 0 && VERSION_END.test(tail) ? tail : undefined;
};

/** Before the label: a version, the word and the label, spaces allowed between. Returns the text from the label on. */
const beforeVersion = (lead: string, word: string, label: string): string | undefined => {
  const version = versionAt(lead);
  if (version === 0) return undefined;
  const atWord = version + spacesAt(lead.slice(version));
  if (!lead.slice(atWord).startsWith(word)) return undefined;
  const atLabel = atWord + word.length + spacesAt(lead.slice(atWord + word.length));
  return lead.slice(atLabel).toLowerCase().startsWith(label.toLowerCase()) ? lead.slice(atLabel) : undefined;
};

/**
 * The line read as the bare label: "End of support for 5.0.0: …" as "End of support: …", "3.0.0 のサポート終了日：…" as
 * "サポート終了日：…". undefined when the line does not start with the label carrying a version that way.
 */
export const withoutLabelVersion = (text: string, label: string, words: VersionWords): string | undefined => {
  const lead = text.replace(LINE_LEAD, "");
  const after = lead.toLowerCase().startsWith(label.toLowerCase())
    ? words.after.map((word) => afterVersion(lead.slice(label.length), word)).find((tail) => tail !== undefined)
    : undefined;
  if (after !== undefined) return `${lead.slice(0, label.length)}${after}`;
  return words.before.map((word) => beforeVersion(lead, word, label)).find((rest) => rest !== undefined);
};
