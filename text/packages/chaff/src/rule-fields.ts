import { RULE_GROUPS } from "./rule-guide.ts";
import { depthOfRewrite, unknownDepthSentence } from "./rewrite-depth.ts";
import type { Texts, UiLanguage } from "./ui.ts";

// The fields a rule has whoever writes it: chaff's own rules/*.yaml, a team's custom_rules and a plugin's rules all
// read these the same way, and all three refuse the same malformed values with the same sentence. Pure: the genres a
// use_for entry may name come in.

export type FieldProblem =
  | { readonly kind: "bad-depth"; readonly written: string }
  | { readonly kind: "bad-group"; readonly written: string }
  | { readonly kind: "bad-use-for"; readonly written: string }
  | { readonly kind: "bad-summary"; readonly written: string }
  | { readonly kind: "bad-text"; readonly written: string }
  | { readonly kind: "bad-example"; readonly written: string };

export type FieldKind = FieldProblem["kind"];

/** Every kind, for a caller that reports these among problems of its own. */
export const FIELD_KINDS: ReadonlySet<string> = new Set<FieldKind>(["bad-depth", "bad-group", "bad-use-for", "bad-summary", "bad-example", "bad-text"]);

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const isText = (value: unknown): value is string => typeof value === "string" && value.trim() !== "";

const printed = (value: unknown): string => (typeof value === "string" ? value : (JSON.stringify(value) ?? typeof value));

/** A text in every language (one string) or by language ({ ja, en }), with no empty text. */
const isTextByLanguage = (value: unknown): boolean =>
  isText(value) || (isRecord(value) && Object.values(value).length > 0 && Object.values(value).every(isText));

const groupProblems = (group: unknown): FieldProblem[] =>
  group === undefined || RULE_GROUPS.some((known) => known === group) ? [] : [{ kind: "bad-group", written: printed(group) }];

/** A use_for entry names a genre or the start of one (business covers business/report). */
const namesGenre = (entry: unknown, genres: readonly string[]): boolean =>
  isText(entry) && genres.some((genre) => genre === entry || genre.startsWith(`${entry}/`));

const useForProblems = (useFor: unknown, genres: readonly string[]): FieldProblem[] => {
  if (useFor === undefined) return [];
  if (!Array.isArray(useFor) || useFor.length === 0) return [{ kind: "bad-use-for", written: printed(useFor) }];
  return useFor.filter((entry: unknown) => !namesGenre(entry, genres)).map((entry: unknown) => ({ kind: "bad-use-for", written: printed(entry) }));
};

const summaryProblems = (summary: unknown): FieldProblem[] =>
  summary === undefined || isTextByLanguage(summary) ? [] : [{ kind: "bad-summary", written: printed(summary) }];

/** A language as a key of a text by language: ja, en, pt-br. */
const LANGUAGE_KEY = /^[a-z]{2,3}(?:-[a-z0-9]+)*$/iu;

/** The texts a reader sees. Each may be one string or one per language. */
const TEXT_FIELDS = ["name", "why", "how_to_fix", "message", "summary"] as const;

/**
 * A text by language whose key is not a language, or whose value is not a text. In YAML, { en: Write a date, or a
 * number of days } is two entries, the second keyed " or a number of days": without this, the text is cut silently.
 */
const textProblems = (raw: Readonly<Record<string, unknown>>): FieldProblem[] =>
  TEXT_FIELDS.flatMap((field) => {
    const value = raw[field];
    if (!isRecord(value)) return [];
    return Object.entries(value)
      .filter(([key, text]) => !LANGUAGE_KEY.test(key) || typeof text !== "string")
      .map(([key]) => ({ kind: "bad-text" as const, written: `${field}: ${JSON.stringify(key)}` }));
  });

/** One example: before and after, each a text in every language or by language. */
const isExamplePair = (value: unknown): boolean => isRecord(value) && isTextByLanguage(value["before"]) && isTextByLanguage(value["after"]);

/**
 * example in either form: { before, after } (a team's rule writes it so), or by language, { ja: { before, after }, en: … }
 * (chaff's rules write it so, with config, pad and other beside before and after).
 */
const exampleProblems = (example: unknown): FieldProblem[] => {
  if (example === undefined) return [];
  if (isRecord(example) && ("before" in example || "after" in example))
    return isExamplePair(example) ? [] : [{ kind: "bad-example", written: printed(example) }];
  if (!isRecord(example) || Object.keys(example).length === 0) return [{ kind: "bad-example", written: printed(example) }];
  return Object.entries(example).flatMap(([language, pair]) => (isExamplePair(pair) ? [] : [{ kind: "bad-example" as const, written: language }]));
};

const depthProblems = (rewrite: unknown): FieldProblem[] => {
  const read = depthOfRewrite(rewrite);
  return "unknown" in read ? [{ kind: "bad-depth", written: read.unknown }] : [];
};

/** What is wrong with the shared fields of one rule as written, in the order the fields are listed here. */
export const fieldProblems = (raw: Readonly<Record<string, unknown>>, genres: readonly string[]): FieldProblem[] => [
  ...groupProblems(raw["group"]),
  ...summaryProblems(raw["summary"]),
  ...useForProblems(raw["use_for"], genres),
  ...exampleProblems(raw["example"]),
  ...depthProblems(raw["rewrite"]),
  ...textProblems(raw),
];

const TEXT: Texts<Readonly<Record<FieldKind, (written: string) => string>>> = {
  ja: {
    "bad-depth": (written) => unknownDepthSentence("rewrite.depth", written, "ja"),
    "bad-group": (written) => `group: ${written} は分類の名前ではありません（${RULE_GROUPS.join(" / ")}）。`,
    "bad-use-for": (written) =>
      `use_for: ${written} はジャンルではありません。ジャンルかその頭（business、business/report）を並べます。一覧は npx chaffjs genres。`,
    "bad-summary": (written) => `summary: ${written} は読めません。一つの文字列か、言語ごとの文字列（{ ja: …, en: … }）で書きます。`,
    "bad-text": (written) =>
      `${written} は言語ではありません。{ } の中のカンマは項目の区切りになるので、カンマのある文は引用符で囲みます（en: "Write a date, or a number of days."）。`,
    "bad-example": (written) =>
      `example: ${written} の before と after が揃っていません。{ before, after } か、言語ごとに { ja: { before, after }, en: { before, after } } と書きます。`,
  },
  en: {
    "bad-depth": (written) => unknownDepthSentence("rewrite.depth", written, "en"),
    "bad-group": (written) => `group: ${written} is not a group (${RULE_GROUPS.join(" / ")}).`,
    "bad-use-for": (written) =>
      `use_for: ${written} is not a genre. List genres or their first part (business, business/report); npx chaffjs genres lists them.`,
    "bad-summary": (written) => `summary: cannot read ${written}. Write one string, or one per language ({ ja: …, en: … }).`,
    "bad-text": (written) =>
      `${written} is not a language. Inside { }, a comma separates entries, so quote a text that has one (en: "Write a date, or a number of days.").`,
    "bad-example": (written) =>
      `example: ${written} lacks a before or an after. Write { before, after }, or one per language: { ja: { before, after }, en: { before, after } }.`,
  },
};

/** What is wrong, with the value as written and what would be right. */
export const fieldProblemSentence = (problem: FieldProblem, ui: UiLanguage): string => TEXT[ui][problem.kind](problem.written);
