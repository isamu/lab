// The documents `yarn rules:measure` measures: a list committed beside corpus/rules-measure.json, so that the
// measurement does not depend on what happens to be in a machine's corpus/.cache. Pure; the script reads the files.

/** The pinned set: the statute files of corpus/laws, and the manifest ids of the other documents. */
export type PinnedSet = { readonly statutes: readonly string[]; readonly documents: readonly string[] };

/** A candidate to measure: its id in the pinned list, whether it is a statute, and whether its text is on this machine. */
export type Candidate = { readonly id: string; readonly statute: boolean; readonly present: boolean };

const isStringList = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === "string" && item !== "");

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/** The pinned set in a file's JSON, or an error naming the file when it is not one. */
export const parsePinned = (text: string, file: string): PinnedSet => {
  const value: unknown = JSON.parse(text);
  if (!isRecord(value) || !isStringList(value["statutes"]) || !isStringList(value["documents"]))
    throw new Error(`${file}: expected { "statutes": [file, ...], "documents": [id, ...] }`);
  return { statutes: value["statutes"], documents: value["documents"] };
};

const keyOf = (statute: boolean, id: string): string => `${statute ? "statute" : "document"} ${id}`;

/** The pinned ids that are not on this machine, or that no candidate has at all: each one a statute or a document. */
export const missingPinned = (candidates: readonly Candidate[], pinned: PinnedSet): string[] => {
  const present = new Set(candidates.filter((candidate) => candidate.present).map((candidate) => keyOf(candidate.statute, candidate.id)));
  return [...pinned.statutes.map((id) => keyOf(true, id)), ...pinned.documents.map((id) => keyOf(false, id))].filter((key) => !present.has(key));
};

/** The candidates on the pinned list, in their own order; anything else (a document fetched for another reason) is left out. */
export const pinnedOnly = <T extends Candidate>(candidates: readonly T[], pinned: PinnedSet): T[] => {
  const keys = new Set([...pinned.statutes.map((id) => keyOf(true, id)), ...pinned.documents.map((id) => keyOf(false, id))]);
  return candidates.filter((candidate) => keys.has(keyOf(candidate.statute, candidate.id)));
};
