import type { ScopeSelector } from "../plugin.ts";
import { scopeSelectorOf, type ScopeProblem } from "../text-scope.ts";

// prefer in chaff.yaml: { avoid: use }, and for an entry limited to some parts of the document the object form
// { avoid: { use, scope } }. Both forms may sit in one map. Pure: the YAML comes in parsed.

/** An entry that could not be read: an object form without use, or with a scope that cannot be read. */
export type PreferProblem =
  { readonly avoid: string; readonly kind: "no-use" } | { readonly avoid: string; readonly kind: "scope"; readonly scope: ScopeProblem };

type Prefer = {
  /** { avoid: use } for every entry, either form. */
  readonly prefer: Readonly<Record<string, string>>;
  /** The scope of each entry written with one. */
  readonly scopes: Readonly<Record<string, ScopeSelector>>;
  readonly problems: readonly PreferProblem[];
};

type Entry = { readonly avoid: string; readonly use: string; readonly scope?: ScopeSelector } | { readonly problem: PreferProblem } | undefined;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const textOf = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

/** The object form: use, and scope when written. */
const objectEntry = (avoid: string, written: Readonly<Record<string, unknown>>): Entry => {
  const use = textOf(written["use"]);
  if (use === "") return { problem: { avoid, kind: "no-use" } };
  if (use === avoid) return undefined;
  if (written["scope"] === undefined) return { avoid, use };
  const read = scopeSelectorOf(written["scope"]);
  return "selector" in read ? { avoid, use, scope: read.selector } : { problem: { avoid, kind: "scope", scope: read.problem } };
};

/** One entry. Both sides must be non-empty and differ (サーバ: サーバ says nothing); a value that is neither form is left out, as before. */
const entryOf = (written: string, value: unknown): Entry => {
  const avoid = written.trim();
  if (avoid === "") return undefined;
  if (isRecord(value)) return objectEntry(avoid, value);
  const use = textOf(value);
  return use === "" || use === avoid ? undefined : { avoid, use };
};

export const preferOf = (raw: unknown): Prefer => {
  const entries = isRecord(raw) ? Object.entries(raw).map(([avoid, value]) => entryOf(avoid, value)) : [];
  const read = entries.flatMap((entry) => (entry === undefined || "problem" in entry ? [] : [entry]));
  return {
    prefer: Object.fromEntries(read.map((entry) => [entry.avoid, entry.use])),
    scopes: Object.fromEntries(read.flatMap((entry) => (entry.scope === undefined ? [] : [[entry.avoid, entry.scope]]))),
    problems: entries.flatMap((entry) => (entry !== undefined && "problem" in entry ? [entry.problem] : [])),
  };
};
