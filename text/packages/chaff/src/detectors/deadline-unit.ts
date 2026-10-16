import type { Span } from "../plugin.ts";

// The unit a duty is written in: its article, else its list, else its paragraph. A duty in a unit that names the dated
// deadline of its own act is timed by it: 「乙は代金を支払う。」 beside 「支払期日までに支払うことができないときは…」. A date
// for another act (a delivery date beside a duty to pay) times nothing. Pure.

/** The spans a document is cut into, from the widest kind that counts as one unit to the narrowest. */
export type Units = { readonly articles: readonly Span[]; readonly lists: readonly Span[]; readonly paragraphs: readonly Span[] };

/** A dated deadline's name (支払期日, due date) and the act it times (支払, pay). */
export type NamedDeadline = { readonly name: string; readonly act: string };

const within = (span: Span, offset: number): boolean => offset >= span.start && offset < span.end;

/** The innermost span holding the offset: an article nested in another is a unit of its own. */
const innermost = (spans: readonly Span[], offset: number): Span | undefined =>
  spans
    .filter((span) => within(span, offset))
    .reduce<Span | undefined>((inner, span) => (inner === undefined || span.start > inner.start ? span : inner), undefined);

/** The unit that holds the offset: its article, else its list, else its paragraph; undefined when none does. */
export const unitAt = (units: Units, offset: number): Span | undefined =>
  [units.articles, units.lists, units.paragraphs].map((spans) => innermost(spans, offset)).find((span) => span !== undefined);

/**
 * The acts whose dated deadline the unit holding the offset names. holds: whether a text holds a name (as a phrase, so
 * that a Latin name is read as whole words).
 */
export const actsTimedAt = (
  source: string,
  units: Units,
  offset: number,
  deadlines: readonly NamedDeadline[],
  holds: (text: string, name: string) => boolean,
): string[] => {
  const unit = unitAt(units, offset);
  if (unit === undefined) return [];
  const text = source.slice(unit.start, unit.end);
  return [...new Set(deadlines.filter((deadline) => holds(text, deadline.name)).map((deadline) => deadline.act))];
};
