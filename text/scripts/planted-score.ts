// The pure half of `yarn planted`: picking the planted sets to run (test/fixtures/planted/<set>/), reading a set's manifest
// of planted mistakes, scoring the findings on the planted and clean documents per kind of mistake, and comparing the
// score with the set's committed one.

/** One planted mistake: the line it is on (1-based), the text the clean document has there and what the planted one has instead. */
export type PlantedMistake = {
  readonly kind: string;
  readonly rule: string;
  readonly line: number;
  readonly clean: string;
  readonly planted: string;
};

export type PlantedDocument = {
  readonly id: string;
  readonly language: string;
  readonly genre: string;
  readonly clean: string;
  readonly planted: string;
  readonly mistakes: readonly PlantedMistake[];
};

export type LineFinding = { readonly rule: string; readonly line: number };

/** How many of one kind's planted mistakes in one language its rule reported on the planted line. missed: "<id>:<line>". */
export type KindRecall = {
  readonly language: string;
  readonly kind: string;
  readonly rule: string;
  readonly found: number;
  readonly total: number;
  readonly missed: readonly string[];
};

/** The committed score: "found/total" by language and kind, and the findings of measured rules on the clean documents. */
export type Expectation = {
  readonly recall: Readonly<Record<string, Readonly<Record<string, string>>>>;
  readonly clean: readonly string[];
};

/**
 * The sets a run covers: every set when none is named, else the named ones in the order given. A name that is not a set
 * is an error that lists the sets, so a typo does not pass as a run that scored nothing.
 */
export const pickSets = (available: readonly string[], requested: readonly string[]): string[] => {
  const sorted = available.toSorted((left, right) => left.localeCompare(right, "en"));
  if (requested.length === 0) return sorted;
  const unknown = requested.filter((name) => !available.includes(name));
  if (unknown.length > 0) throw new Error(`planted: no set ${unknown.join(", ")} (sets: ${sorted.join(", ")})`);
  return [...new Set(requested)];
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const stringField = (entry: Record<string, unknown>, field: string, where: string): string => {
  const value = entry[field];
  if (typeof value !== "string" || value === "") throw new Error(`planted manifest: ${where} has no ${field}`);
  return value;
};

const mistakeOf = (value: unknown, where: string): PlantedMistake => {
  if (!isRecord(value)) throw new Error(`planted manifest: ${where} is not an object`);
  const { line } = value;
  if (typeof line !== "number" || !Number.isInteger(line) || line < 1) throw new Error(`planted manifest: ${where} has no line`);
  return {
    kind: stringField(value, "kind", where),
    rule: stringField(value, "rule", where),
    line,
    clean: stringField(value, "clean", where),
    planted: stringField(value, "planted", where),
  };
};

const documentOf = (value: unknown, index: number): PlantedDocument => {
  const where = `documents[${String(index)}]`;
  if (!isRecord(value)) throw new Error(`planted manifest: ${where} is not an object`);
  const id = stringField(value, "id", where);
  const { mistakes } = value;
  if (!Array.isArray(mistakes)) throw new Error(`planted manifest: ${id} has no mistakes`);
  return {
    id,
    language: stringField(value, "language", where),
    genre: stringField(value, "genre", where),
    clean: stringField(value, "clean", where),
    planted: stringField(value, "planted", where),
    mistakes: mistakes.map((mistake: unknown, at) => mistakeOf(mistake, `${id} mistakes[${String(at)}]`)),
  };
};

export const parseManifest = (value: unknown): PlantedDocument[] => {
  if (!isRecord(value) || !Array.isArray(value.documents)) throw new Error("planted manifest: no documents");
  return value.documents.map(documentOf);
};

/**
 * Each planted mistake whose line does not hold its text: the clean line must have `clean` and the planted line
 * `planted`. A line that moved when one of the documents was edited would score a finding against the wrong line.
 */
export const misalignedPlants = (document: PlantedDocument, cleanLines: readonly string[], plantedLines: readonly string[]): string[] =>
  document.mistakes.flatMap((mistake) => {
    const cleanLine = cleanLines[mistake.line - 1] ?? "";
    const plantedLine = plantedLines[mistake.line - 1] ?? "";
    const problems = [
      ...(cleanLine.includes(mistake.clean) ? [] : [`clean line has no "${mistake.clean}"`]),
      ...(plantedLine.includes(mistake.planted) ? [] : [`planted line has no "${mistake.planted}"`]),
    ];
    return problems.map((problem) => `${document.id}:${String(mistake.line)} ${mistake.kind}: ${problem}`);
  });

const keyOf = (language: string, kind: string): string => `${language}\u0000${kind}`;

/** Per language and kind, in the order the manifest first names them: which planted mistakes their rule reported on their line. */
export const recallByKind = (documents: readonly PlantedDocument[], plantedFindings: ReadonlyMap<string, readonly LineFinding[]>): KindRecall[] => {
  const byKind = new Map<string, KindRecall>();
  documents.forEach((document) => {
    const findings = plantedFindings.get(document.id) ?? [];
    document.mistakes.forEach((mistake) => {
      const key = keyOf(document.language, mistake.kind);
      const previous = byKind.get(key) ?? { language: document.language, kind: mistake.kind, rule: mistake.rule, found: 0, total: 0, missed: [] };
      const found = findings.some((finding) => finding.rule === mistake.rule && finding.line === mistake.line);
      byKind.set(key, {
        ...previous,
        found: previous.found + (found ? 1 : 0),
        total: previous.total + 1,
        missed: found ? previous.missed : [...previous.missed, `${document.id}:${String(mistake.line)}`],
      });
    });
  });
  return [...byKind.values()];
};

/** The rules the manifest expects to report a planted mistake: a clean document should get none of their findings. */
export const measuredRules = (documents: readonly PlantedDocument[]): ReadonlySet<string> =>
  new Set(documents.flatMap((document) => document.mistakes.map((mistake) => mistake.rule)));

/** The measured rules' findings on the clean documents, as "<clean file>:<line> <rule>", sorted. */
export const cleanFindingLines = (documents: readonly PlantedDocument[], cleanFindings: ReadonlyMap<string, readonly LineFinding[]>): string[] => {
  const measured = measuredRules(documents);
  return documents
    .flatMap((document) =>
      (cleanFindings.get(document.id) ?? [])
        .filter((finding) => measured.has(finding.rule))
        .map((finding) => `${document.clean}:${String(finding.line)} ${finding.rule}`),
    )
    .toSorted((left, right) => left.localeCompare(right, "en"));
};

export const expectationOf = (recalls: readonly KindRecall[], clean: readonly string[]): Expectation => {
  const recall: Record<string, Record<string, string>> = {};
  recalls.forEach((entry) => {
    recall[entry.language] = { ...recall[entry.language], [entry.kind]: `${String(entry.found)}/${String(entry.total)}` };
  });
  return { recall, clean: [...clean] };
};

const recordOfStrings = (value: unknown): Record<string, string> =>
  isRecord(value) ? Object.fromEntries(Object.entries(value).flatMap(([key, entry]) => (typeof entry === "string" ? [[key, entry]] : []))) : {};

/** The committed expectation as written in expected.json; anything it cannot read counts as absent. */
export const parseExpectation = (value: unknown): Expectation => {
  if (!isRecord(value)) return { recall: {}, clean: [] };
  const recall = isRecord(value.recall) ? Object.fromEntries(Object.entries(value.recall).map(([language, kinds]) => [language, recordOfStrings(kinds)])) : {};
  const clean = Array.isArray(value.clean) ? value.clean.filter((entry): entry is string => typeof entry === "string") : [];
  return { recall, clean };
};

const foundOf = (score: string | undefined): number | undefined => {
  const match = /^(\d+)\/(\d+)$/u.exec(score ?? "");
  return match === null ? undefined : Number(match[1]);
};

const recallChange = (language: string, kind: string, expected: string | undefined, actual: string | undefined): string[] => {
  if (expected === actual) return [];
  const before = foundOf(expected);
  const after = foundOf(actual);
  const direction = before !== undefined && after !== undefined && after < before ? "dropped" : "changed";
  return [`  recall ${direction}: ${language} ${kind} ${expected ?? "(none)"} -> ${actual ?? "(none)"}`];
};

/** Every way the actual score differs from the committed one: a recall that moved, a clean finding gained or lost. */
export const expectationChanges = (expected: Expectation, actual: Expectation): string[] => {
  const languages = [...new Set([...Object.keys(expected.recall), ...Object.keys(actual.recall)])];
  const recall = languages.flatMap((language) => {
    const before = expected.recall[language] ?? {};
    const after = actual.recall[language] ?? {};
    return [...new Set([...Object.keys(before), ...Object.keys(after)])].flatMap((kind) => recallChange(language, kind, before[kind], after[kind]));
  });
  const gained = actual.clean.filter((entry) => !expected.clean.includes(entry)).map((entry) => `  clean document gained: ${entry}`);
  const lost = expected.clean.filter((entry) => !actual.clean.includes(entry)).map((entry) => `  clean document lost: ${entry}`);
  return [...recall, ...gained, ...lost];
};

/** The score as a table, one line per language and kind, with the planted mistakes each missed. */
export const formatRecall = (recalls: readonly KindRecall[]): string[] => {
  const kindWidth = Math.max(0, ...recalls.map((entry) => entry.kind.length));
  const ruleWidth = Math.max(0, ...recalls.map((entry) => entry.rule.length));
  return recalls.map((entry) => {
    const score = `${String(entry.found)}/${String(entry.total)}`.padStart(5);
    const missed = entry.missed.length === 0 ? "" : `  missed ${entry.missed.join(", ")}`;
    return `${entry.language}  ${entry.kind.padEnd(kindWidth)}  ${entry.rule.padEnd(ruleWidth)}  ${score}${missed}`;
  });
};
