import type { ScopeSelector, Span, TextScope } from "./plugin.ts";

// scope: in chaff.yaml (custom_rules and prefer): which parts of a document a team's rule reads. Pure.
// Positives choose where (none written: every part); negatives (~quote) then take parts away.

export const TEXT_SCOPES: readonly TextScope[] = ["heading", "list", "table", "quote", "paragraph"];

const NEGATION = "~";

/** not-a-list: neither a name nor a list of names. unknown: a name that is not a scope. empty: it leaves no text to read. */
export type ScopeProblem =
  | { readonly kind: "not-a-list"; readonly written: string }
  | { readonly kind: "unknown"; readonly written: string }
  | { readonly kind: "empty"; readonly written: string };

export type ScopeRead = { readonly selector: ScopeSelector } | { readonly problem: ScopeProblem };

const printed = (value: unknown): string => JSON.stringify(value) ?? String(value);

const scopeNamed = (name: string): TextScope | undefined => TEXT_SCOPES.find((scope) => scope === name);

type Term = { readonly scope: TextScope; readonly negated: boolean };

const termOf = (written: string): Term | undefined => {
  const trimmed = written.trim();
  const negated = trimmed.startsWith(NEGATION);
  const scope = scopeNamed(negated ? trimmed.slice(NEGATION.length).trim() : trimmed);
  return scope === undefined ? undefined : { scope, negated };
};

const unique = (scopes: readonly TextScope[]): TextScope[] => TEXT_SCOPES.filter((scope) => scopes.includes(scope));

/** A selector that no passage can meet: every part it chooses is also taken away. */
const selectsNothing = (selector: ScopeSelector): boolean => {
  const chosen = selector.include.length === 0 ? TEXT_SCOPES : selector.include;
  return chosen.every((scope) => selector.exclude.includes(scope));
};

/** scope as written: one name or a list of names, each optionally negated with a leading ~. */
export const scopeSelectorOf = (raw: unknown): ScopeRead => {
  const list: readonly unknown[] = Array.isArray(raw) ? raw : [raw];
  if (list.length === 0) return { problem: { kind: "empty", written: printed(raw) } };
  if (!list.every((entry) => typeof entry === "string")) return { problem: { kind: "not-a-list", written: printed(raw) } };
  const names = list.filter((entry): entry is string => typeof entry === "string");
  const unknown = names.find((name) => termOf(name) === undefined);
  if (unknown !== undefined) return { problem: { kind: "unknown", written: unknown } };
  const terms = names.flatMap((name) => termOf(name) ?? []);
  const selector: ScopeSelector = {
    include: unique(terms.filter((term) => !term.negated).map((term) => term.scope)),
    exclude: unique(terms.filter((term) => term.negated).map((term) => term.scope)),
  };
  return selectsNothing(selector) ? { problem: { kind: "empty", written: printed(raw) } } : { selector };
};

/** Whether a passage in these parts is read: in a chosen part (or any part, when none is chosen) and in no part taken away. */
export const inScope = (selector: ScopeSelector, scopes: readonly TextScope[]): boolean =>
  (selector.include.length === 0 ? scopes.length > 0 : selector.include.some((scope) => scopes.includes(scope))) &&
  !selector.exclude.some((scope) => scopes.includes(scope));

/** The selector as chaff.yaml writes it, for messages and explain: [list, ~quote]. */
export const writtenScope = (selector: ScopeSelector): string => {
  const names = [...selector.include, ...selector.exclude.map((scope) => NEGATION + scope)];
  return `[${names.join(", ")}]`;
};

/** Where the list items and the quotations of a document are. */
export type ScopeRegions = { readonly list: readonly Span[]; readonly quote: readonly Span[] };

const startsIn = (span: Span, regions: readonly Span[]): boolean => regions.some((region) => span.start >= region.start && span.start < region.end);

/**
 * The parts a passage starting at span is in. own is what the passage itself is (a heading, a table cell); a list item
 * and a quotation are found around it. A passage in none of these is paragraph.
 */
export const scopesOf = (span: Span, regions: ScopeRegions, own?: "heading" | "table"): TextScope[] => {
  const around: Readonly<Partial<Record<TextScope, readonly Span[]>>> = { list: regions.list, quote: regions.quote };
  const found = TEXT_SCOPES.filter((scope) => scope === own || startsIn(span, around[scope] ?? []));
  return found.length === 0 ? ["paragraph"] : found;
};
