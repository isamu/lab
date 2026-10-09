// required-listed-as-preferred: one skill or qualification listed under a required heading or label and again under a
// preferred one. The headings and labels, the units and words of a length of experience, and the words that only end an
// item come from the lexicons. Pure.
import { escapeRegExp } from "../orthography.ts";
import type { StructureIssue } from "./issues.ts";

/** A heading, a line standing alone (a label if it is one of the words), or one list item, in document order. */
export type RequirementBlock =
  | { readonly kind: "heading"; readonly depth: number; readonly text: string; readonly offset: number }
  | { readonly kind: "line"; readonly text: string; readonly offset: number }
  | { readonly kind: "item"; readonly text: string; readonly offset: number };

export type ValuedWord = { readonly word: string; readonly value: number };

export type RequirementWords = {
  /** Headings and labels of what an applicant must have (必須, Required) and of what is welcome (歓迎, Preferred). */
  readonly required: readonly string[];
  readonly preferred: readonly string[];
  /** Units of a length of experience, valued in months (年 12, month 1). */
  readonly units: readonly ValuedWord[];
  /** Words that stand before or after a length and belong to it (at least, 以上, of). */
  readonly before: readonly string[];
  readonly after: readonly string[];
  /** Numbers written as words (three, 三). */
  readonly numbers: readonly ValuedWord[];
  /** Words that only end an item and are not the skill (の方, こと). */
  readonly endings: readonly string[];
};

type Kind = "required" | "preferred";

/** container is the offset of the heading holding the lists (a posting, 応募の条件), -1 for none; only one container's items are compared. */
type Requirement = { readonly kind: Kind; readonly text: string; readonly offset: number; readonly container: number };

/** The skill an item names with its length of experience taken out, and that length in months (0 when none). */
type Reading = { readonly core: string; readonly months: number };

const MARKS = /[*_`~]/gu;

const LATIN = /^[a-z]/u;

const plain = (text: string): string => text.normalize("NFKC").toLowerCase().replace(MARKS, "").replace(/\s+/gu, " ").trim();

/** A Latin word is matched at word edges; other scripts as written. */
const wordPattern = (word: string): string => {
  const escaped = escapeRegExp(plain(word));
  return LATIN.test(plain(word)) ? `(?<![a-z])${escaped}(?![a-z])` : escaped;
};

const alternation = (words: readonly string[]): string =>
  words
    .toSorted((left, right) => right.length - left.length)
    .map(wordPattern)
    .join("|");

/** The text without the characters at either end that the test accepts (no backtracking regex on long lines). */
const trimWhere = (text: string, isEdge: (char: string) => boolean): string => {
  const chars = [...text];
  const start = chars.findIndex((char) => !isEdge(char));
  return start === -1 ? "" : chars.slice(start, chars.findLastIndex((char) => !isEdge(char)) + 1).join("");
};

const LABEL_EDGE = /[\s【［[「(（】］\]」)）:：]/u;

const asLabel = (text: string): string => trimWhere(plain(text).replace(/[-‐–]/gu, " "), (char) => LABEL_EDGE.test(char)).replace(/\s+/gu, " ");

const kindOfLabel = (label: string, words: RequirementWords): Kind | undefined => {
  if (label === "") return undefined;
  if (words.required.some((word) => asLabel(word) === label)) return "required";
  return words.preferred.some((word) => asLabel(word) === label) ? "preferred" : undefined;
};

const HEADING_PARTS = /[・/／、,，(（:：]/u;

/** A heading names its kind by its first part (必須スキル・経験, 歓迎（あれば尚可）); a line standing alone, by all of it. */
const kindOfHeading = (text: string, words: RequirementWords): Kind | undefined => kindOfLabel(asLabel(text.split(HEADING_PARTS)[0] ?? ""), words);

type Scope = { readonly depth: number; readonly kind: Kind | undefined; readonly offset: number };

type Walk = { readonly scopes: readonly Scope[]; readonly label: Kind | undefined; readonly items: readonly Requirement[] };

/** A heading opens a scope that its subheadings inherit unless they name their own kind; a label holds until the next heading or label. */
const step = (walk: Walk, block: RequirementBlock, words: RequirementWords): Walk => {
  if (block.kind === "heading") {
    const outer = walk.scopes.filter((scope) => scope.depth < block.depth);
    const kind = kindOfHeading(block.text, words) ?? outer.at(-1)?.kind;
    return { ...walk, scopes: [...outer, { depth: block.depth, kind, offset: block.offset }], label: undefined };
  }
  if (block.kind === "line") {
    const kind = kindOfLabel(asLabel(block.text), words);
    return kind === undefined ? walk : { ...walk, label: kind };
  }
  const kind = walk.label ?? walk.scopes.at(-1)?.kind;
  const container = walk.scopes.findLast((scope) => scope.kind === undefined)?.offset ?? -1;
  return kind === undefined ? walk : { ...walk, items: [...walk.items, { kind, text: block.text.trim(), offset: block.offset, container }] };
};

const numberPattern = (words: RequirementWords): string =>
  [String.raw`\d+(?:\.\d+)?`, alternation(words.numbers.map((entry) => entry.word))].filter((part) => part !== "").join("|");

const lengthPattern = (words: RequirementWords): RegExp | undefined => {
  if (words.units.length === 0) return undefined;
  const before = words.before.length === 0 ? "" : `(?:(?:${alternation(words.before)})\\s*)?`;
  const after = words.after.length === 0 ? "" : `(?:\\s*(?:${alternation(words.after)}))*`;
  return new RegExp(`${before}(${numberPattern(words)})\\s*\\+?\\s*(${alternation(words.units.map((unit) => unit.word))})['’]?${after}`, "gu");
};

const valueOf = (written: string, words: readonly ValuedWord[]): number => words.find((entry) => plain(entry.word) === written)?.value ?? Number(written);

/** Punctuation, symbols and spaces, but not the + and # that end a name (C++, C#). */
const PUNCTUATION = /(?<![\p{L}\p{N}+#])[+#]|[^\p{L}\p{N}+#]/gu;

const EDGE_PUNCTUATION = /[\p{P}\s]/u;

const withoutEnding = (written: string, endings: readonly string[]): string => {
  const text = trimWhere(written, (char) => char !== "#" && EDGE_PUNCTUATION.test(char));
  const ending = endings.map(plain).find((word) => word !== "" && text.endsWith(word) && text.length > word.length);
  return ending === undefined ? text : withoutEnding(text.slice(0, -ending.length), endings);
};

const readingOf = (text: string, words: RequirementWords): Reading => {
  const written = plain(text);
  const pattern = lengthPattern(words);
  const lengths = pattern === undefined ? [] : [...written.matchAll(pattern)];
  const months = lengths.map((match) => valueOf(match[1] ?? "", words.numbers) * (words.units.find((unit) => plain(unit.word) === match[2])?.value ?? 0));
  const rest = pattern === undefined ? written : written.replace(pattern, " ");
  return { core: withoutEnding(rest.replace(/\s+/gu, " ").trim(), words.endings).replace(PUNCTUATION, ""), months: Math.max(0, ...months) };
};

/** A preferred item repeats a required one when it names the same skill and asks for no longer experience. */
const repeats = (preferred: Reading, required: Reading): boolean =>
  preferred.core !== "" && preferred.core === required.core && preferred.months <= required.months;

/** The preferred items that repeat a required item of the same document, once each, in document order. */
export const requiredListedAsPreferred = (blocks: readonly RequirementBlock[], words: RequirementWords): StructureIssue[] => {
  const { items } = blocks.reduce<Walk>((walk, block) => step(walk, block, words), { scopes: [], label: undefined, items: [] });
  const required = items.filter((item) => item.kind === "required").map((item) => ({ item, reading: readingOf(item.text, words) }));
  return items
    .filter((item) => item.kind === "preferred")
    .flatMap((item) => {
      const reading = readingOf(item.text, words);
      const match = required.find((candidate) => candidate.item.container === item.container && repeats(reading, candidate.reading));
      return match === undefined ? [] : [{ offset: item.offset, values: { item: item.text, required: match.item.text } }];
    });
};
