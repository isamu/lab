// One line of `chaff grade`'s input: a model's output and what to check it against. Pure: reads text, returns items
// or what is wrong with them, so a harness that writes the file can be told which line to fix.

export type GradeCitation = { readonly source: string; readonly address: string; readonly quote: string };

export type GradeItem = {
  readonly id: string;
  readonly output: string;
  readonly reference?: string | undefined;
  /** Each source's name and text. A citation names the one it quotes. */
  readonly sources: Readonly<Record<string, string>>;
  /** What the output quoted. Undefined when not given: chaff does not guess quotations from the output's text. */
  readonly citations?: readonly GradeCitation[] | undefined;
  readonly language?: string | undefined;
  readonly genre?: string | undefined;
};

export type ItemProblemKind =
  | "not-json"
  | "not-object"
  | "no-id"
  | "no-output"
  | "not-string"
  | "not-text-map"
  | "not-citations"
  | "citations-without-sources"
  | "duplicate-id"
  | "unknown-source"
  | "which-source"
  | "unknown-language"
  | "unknown-genre"
  | "empty";

/** Why a line cannot be graded. `detail`: the field, the value or the parser's message; `first`: the line an id was first on. */
export type ItemProblem = { readonly kind: ItemProblemKind; readonly line: number; readonly detail?: string; readonly first?: number };

/** What an item may name: the languages chaff can load and the genres it knows. */
export type ItemVocabulary = { readonly isLanguage: (language: string) => boolean; readonly genres: readonly string[] };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const isTextMap = (value: unknown): value is Record<string, string> => isRecord(value) && Object.values(value).every((text) => typeof text === "string");

type Parsed<T> = { readonly value: T } | { readonly problem: ItemProblem };

const optionalString = (raw: Record<string, unknown>, field: string, line: number): Parsed<string | undefined> => {
  const value = raw[field];
  if (value === undefined || typeof value === "string") return { value };
  return { problem: { kind: "not-string", line, detail: field } };
};

type RawCitation = { readonly source?: unknown; readonly address: string; readonly quote: string };

const isRawCitation = (value: unknown): value is RawCitation =>
  isRecord(value) && typeof value["address"] === "string" && typeof value["quote"] === "string" && ["string", "undefined"].includes(typeof value["source"]);

/** A citation's source: the one named, or the only one given. */
const citedSource = (citation: RawCitation, sources: Readonly<Record<string, string>>, line: number): Parsed<string> => {
  const names = Object.keys(sources);
  if (typeof citation.source === "string") {
    return names.includes(citation.source) ? { value: citation.source } : { problem: { kind: "unknown-source", line, detail: citation.source } };
  }
  const [only] = names;
  return names.length === 1 && only !== undefined ? { value: only } : { problem: { kind: "which-source", line, detail: citation.address } };
};

const citationsOf = (raw: unknown, sources: Readonly<Record<string, string>>, line: number): Parsed<GradeCitation[] | undefined> => {
  if (raw === undefined) return { value: undefined };
  if (!Array.isArray(raw) || !raw.every(isRawCitation)) return { problem: { kind: "not-citations", line } };
  if (Object.keys(sources).length === 0) return { problem: { kind: "citations-without-sources", line } };
  const entries: readonly RawCitation[] = raw;
  const resolved = entries.map((citation) => ({ citation, source: citedSource(citation, sources, line) }));
  const failed = resolved.find((entry) => "problem" in entry.source);
  if (failed !== undefined && "problem" in failed.source) return failed.source;
  return {
    value: resolved.flatMap(({ citation, source }) => ("value" in source ? [{ source: source.value, address: citation.address, quote: citation.quote }] : [])),
  };
};

const sourcesOf = (raw: unknown, line: number): Parsed<Readonly<Record<string, string>>> => {
  if (raw === undefined) return { value: {} };
  return isTextMap(raw) ? { value: raw } : { problem: { kind: "not-text-map", line, detail: "sources" } };
};

/** The fields that are optional strings, read together so the first wrong one is reported. */
const textFields = (raw: Record<string, unknown>, line: number): Parsed<{ reference?: string; language?: string; genre?: string }> => {
  const read = (["reference", "language", "genre"] as const).map((field) => ({ field, parsed: optionalString(raw, field, line) }));
  const failed = read.find((entry) => "problem" in entry.parsed);
  if (failed !== undefined && "problem" in failed.parsed) return failed.parsed;
  return {
    value: Object.fromEntries(
      read.flatMap((entry) => ("value" in entry.parsed && entry.parsed.value !== undefined ? [[entry.field, entry.parsed.value]] : [])),
    ),
  };
};

const vocabularyProblem = (fields: { language?: string; genre?: string }, vocabulary: ItemVocabulary, line: number): ItemProblem | undefined => {
  if (fields.language !== undefined && !vocabulary.isLanguage(fields.language)) return { kind: "unknown-language", line, detail: fields.language };
  if (fields.genre !== undefined && !vocabulary.genres.includes(fields.genre)) return { kind: "unknown-genre", line, detail: fields.genre };
  return undefined;
};

const itemOf = (raw: Record<string, unknown>, line: number, vocabulary: ItemVocabulary): Parsed<GradeItem> => {
  const id = raw["id"];
  if (typeof id !== "string" || id === "") return { problem: { kind: "no-id", line } };
  const output = raw["output"];
  if (typeof output !== "string") return { problem: { kind: "no-output", line } };
  const fields = textFields(raw, line);
  if ("problem" in fields) return fields;
  const unknown = vocabularyProblem(fields.value, vocabulary, line);
  if (unknown !== undefined) return { problem: unknown };
  const sources = sourcesOf(raw["sources"], line);
  if ("problem" in sources) return sources;
  const citations = citationsOf(raw["citations"], sources.value, line);
  if ("problem" in citations) return citations;
  return { value: { id, output, ...fields.value, sources: sources.value, citations: citations.value } };
};

/** One item from a value already parsed, as `grade()` receives it; `line` is 0 when it came from no file. */
export const readItem = (raw: unknown, vocabulary: ItemVocabulary, line = 0): { readonly item: GradeItem } | { readonly problem: ItemProblem } => {
  const read = isRecord(raw) ? itemOf(raw, line, vocabulary) : { problem: { kind: "not-object" as const, line } };
  return "value" in read ? { item: read.value } : read;
};

const parseLine = (text: string, line: number, vocabulary: ItemVocabulary): Parsed<GradeItem> => {
  try {
    const raw: unknown = JSON.parse(text);
    return isRecord(raw) ? itemOf(raw, line, vocabulary) : { problem: { kind: "not-object", line } };
  } catch (error) {
    return { problem: { kind: "not-json", line, detail: error instanceof Error ? error.message : String(error) } };
  }
};

/** An id seen on an earlier line: two outputs under one id could not be paired in an A/B comparison. */
const duplicates = (items: readonly { readonly item: GradeItem; readonly line: number }[]): ItemProblem[] => {
  const firstLine = new Map<string, number>();
  return items.flatMap(({ item, line }) => {
    const first = firstLine.get(item.id);
    if (first === undefined) firstLine.set(item.id, line);
    return first === undefined ? [] : [{ kind: "duplicate-id", line, detail: item.id, first }];
  });
};

/** Every item of a JSONL text, or every problem found. A blank line is skipped; no item at all is a problem, not a clean run. */
export const parseItems = (
  text: string,
  vocabulary: ItemVocabulary,
): { readonly items: readonly GradeItem[] } | { readonly problems: readonly ItemProblem[] } => {
  const lines = text.split(/\r?\n/u).map((body, index) => ({ body, line: index + 1 }));
  const parsed = lines.filter(({ body }) => body.trim() !== "").map(({ body, line }) => ({ line, parsed: parseLine(body, line, vocabulary) }));
  const read = parsed.flatMap(({ line, parsed: entry }) => ("value" in entry ? [{ item: entry.value, line }] : []));
  const problems = [...parsed.flatMap(({ parsed: entry }) => ("problem" in entry ? [entry.problem] : [])), ...duplicates(read)];
  if (problems.length > 0) return { problems: problems.toSorted((left, right) => left.line - right.line) };
  return read.length === 0 ? { problems: [{ kind: "empty", line: 0 }] } : { items: read.map((entry) => entry.item) };
};
