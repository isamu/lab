import { guideLinesOf, type GuideLines } from "./lines.ts";

// A team's changes to the genre guides, as chaff.yaml, a style or a rule pack writes them under guide:
//
//   guide:
//     blog/tech:                # a genre, or a group (legal) for every genre in it
//       add: { ja: [...], en: [...] }
//     legal/contract:
//       replace: { ja: [...], en: [...] }
//     business/email: off
//
// replace sets the lines for the languages it gives (the others keep theirs); add puts lines after them; off leaves the
// genre with no guide. A text or a list alone, without ja: or en:, is the same in every language. guide: off turns every
// genre's guide off; a stronger layer may still add lines back.

export type GuideEdit = { readonly kind: "off" } | { readonly kind: "edit"; readonly replace?: GuideLines; readonly add?: GuideLines };

/**
 * One place's changes, by genre or group, and the place as a reader is told it (chaff.yaml, style: house, plugins: foo).
 * allOff: guide: off, which empties every genre's guide before this layer's own entries.
 */
export type GuideLayer = { readonly from: string; readonly allOff: boolean; readonly edits: Readonly<Record<string, GuideEdit>> };

/** What could not be read: the genre or group it was written under (none when guide: itself is wrong), and what was there. */
export type GuideProblem =
  | { readonly kind: "not-a-map"; readonly written: string }
  | { readonly kind: "unknown-genre"; readonly genre: string }
  | { readonly kind: "bad-entry"; readonly genre: string; readonly written: string }
  | { readonly kind: "bad-lines"; readonly genre: string; readonly field: "replace" | "add" };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const printed = (value: unknown): string => JSON.stringify(value) ?? String(value);

/** Whether guide: as written turns every guide off (guide: off, or false). */
export const turnsGuidesOff = (raw: unknown): boolean => raw === "off" || raw === false;

const EDIT_FIELDS: ReadonlySet<string> = new Set(["replace", "add"]);

type Read = { readonly edit: GuideEdit } | { readonly problem: GuideProblem };

type LinesRead = { readonly lines: GuideLines | undefined } | { readonly problem: GuideProblem };

const linesIn = (raw: Record<string, unknown>, field: "replace" | "add", genre: string): LinesRead => {
  if (raw[field] === undefined) return { lines: undefined };
  const lines = guideLinesOf(raw[field]);
  return lines === undefined ? { problem: { kind: "bad-lines", genre, field } } : { lines };
};

const editOf = (genre: string, value: unknown): Read => {
  if (turnsGuidesOff(value)) return { edit: { kind: "off" } };
  const fields = isRecord(value) ? Object.keys(value) : [];
  if (!isRecord(value) || fields.length === 0 || fields.some((field) => !EDIT_FIELDS.has(field))) {
    return { problem: { kind: "bad-entry", genre, written: printed(value) } };
  }
  const replace = linesIn(value, "replace", genre);
  if ("problem" in replace) return replace;
  const add = linesIn(value, "add", genre);
  if ("problem" in add) return add;
  return { edit: { kind: "edit", ...(replace.lines === undefined ? {} : { replace: replace.lines }), ...(add.lines === undefined ? {} : { add: add.lines }) } };
};

/**
 * guide: as written, read into a layer. known: the genres and groups an entry may name. An entry that cannot be read is
 * left out and reported; the rest still apply. Nothing written is an empty layer.
 */
export const guideLayerOf = (raw: unknown, from: string, known: readonly string[]): { layer: GuideLayer; problems: GuideProblem[] } => {
  if (raw === undefined || raw === null || turnsGuidesOff(raw)) return { layer: { from, allOff: turnsGuidesOff(raw), edits: {} }, problems: [] };
  if (!isRecord(raw)) return { layer: { from, allOff: false, edits: {} }, problems: [{ kind: "not-a-map", written: printed(raw) }] };
  const read = Object.entries(raw).map(([genre, value]): readonly [string, Read] =>
    known.includes(genre) ? [genre, editOf(genre, value)] : [genre, { problem: { kind: "unknown-genre", genre } }],
  );
  return {
    layer: { from, allOff: false, edits: Object.fromEntries(read.flatMap(([genre, entry]) => ("edit" in entry ? [[genre, entry.edit]] : []))) },
    problems: read.flatMap(([, entry]) => ("problem" in entry ? [entry.problem] : [])),
  };
};
