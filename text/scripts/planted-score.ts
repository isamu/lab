// The pure half of `yarn planted`: picking the planted sets to run (test/fixtures/planted/<set>/), reading a set's manifest
// of planted mistakes, scoring the findings on the planted and clean documents per kind of mistake, and comparing the
// score with the set's committed one (only a regression fails; an improvement is reported until it is recorded).

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
  /** The house style (styles/*.yaml) the document is run with, as chaff.yaml's style: would set it. */
  readonly style?: string;
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

/** A style is optional; one that is written must be a name. */
const styleOf = (entry: Record<string, unknown>, where: string): Pick<PlantedDocument, "style"> =>
  entry["style"] === undefined ? {} : { style: stringField(entry, "style", where) };

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
    ...styleOf(value, id),
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

const scorePattern = /^(\d+)\/(\d+)$/u;

type Score = { readonly found: number; readonly total: number };

const scoreOf = (text: string): Score | undefined => {
  const match = scorePattern.exec(text);
  if (match === null) return undefined;
  const score = { found: Number(match[1]), total: Number(match[2]) };
  return score.found <= score.total ? score : undefined;
};

const recallOfLanguage = (value: unknown, where: string): Record<string, string> => {
  if (!isRecord(value)) throw new Error(`${where} is not an object of kinds`);
  return Object.fromEntries(
    Object.entries(value).map(([kind, score]) => {
      if (typeof score !== "string" || scoreOf(score) === undefined) throw new Error(`${where}.${kind} is ${JSON.stringify(score)}, not "found/total"`);
      return [kind, score];
    }),
  );
};

/** The committed expectation as written in expected.json. `where` names the file; anything malformed throws, saying where. */
export const parseExpectation = (value: unknown, where = "expected.json"): Expectation => {
  if (!isRecord(value)) throw new Error(`${where} is not an object with recall and clean`);
  if (!isRecord(value.recall)) throw new Error(`${where} has no recall object`);
  const recall = Object.fromEntries(
    Object.entries(value.recall).map(([language, kinds]) => [language, recallOfLanguage(kinds, `${where} recall.${language}`)]),
  );
  const clean = Array.isArray(value.clean) ? value.clean.filter((entry): entry is string => typeof entry === "string") : [];
  if (!Array.isArray(value.clean) || clean.length !== value.clean.length) throw new Error(`${where} has no clean list of strings`);
  return { recall, clean };
};

/** How a run differs from expected.json: regressions fail the run, improvements are only reported until --update records them. */
export type ExpectationComparison = { readonly regressions: readonly string[]; readonly improvements: readonly string[] };

const NO_CHANGE: ExpectationComparison = { regressions: [], improvements: [] };
const regression = (line: string): ExpectationComparison => ({ regressions: [line], improvements: [] });
const improvement = (line: string): ExpectationComparison => ({ regressions: [], improvements: [line] });

const combine = (parts: readonly ExpectationComparison[]): ExpectationComparison => ({
  regressions: parts.flatMap((part) => part.regressions),
  improvements: parts.flatMap((part) => part.improvements),
});

/**
 * One kind's recall against the record. Only a rise in what was found is an improvement: a kind that appeared or
 * disappeared, or a changed number of planted mistakes, is a manifest edit that has to be recorded on purpose.
 */
const compareRecall = (language: string, kind: string, expected: string | undefined, actual: string | undefined): ExpectationComparison => {
  if (expected === actual) return NO_CHANGE;
  const change = `${language} ${kind} ${expected ?? "(none)"} -> ${actual ?? "(none)"}`;
  if (expected === undefined) return regression(`  kind not in expected.json: ${change}`);
  if (actual === undefined) return regression(`  kind no longer scored: ${change}`);
  const before = scoreOf(expected);
  const after = scoreOf(actual);
  if (before === undefined || after === undefined) return regression(`  unreadable score: ${change}`);
  if (before.total !== after.total) return regression(`  planted count changed: ${change}`);
  return after.found < before.found ? regression(`  recall dropped: ${change}`) : improvement(`  recall rose: ${change}`);
};

/** The actual score against the committed one: what got worse (or changed shape) and what got better. */
export const compareToExpected = (expected: Expectation, actual: Expectation): ExpectationComparison => {
  const languages = [...new Set([...Object.keys(expected.recall), ...Object.keys(actual.recall)])];
  const recall = languages.flatMap((language) => {
    const before = expected.recall[language] ?? {};
    const after = actual.recall[language] ?? {};
    return [...new Set([...Object.keys(before), ...Object.keys(after)])].map((kind) => compareRecall(language, kind, before[kind], after[kind]));
  });
  const gained = actual.clean.filter((entry) => !expected.clean.includes(entry)).map((entry) => regression(`  clean document gained: ${entry}`));
  const lost = expected.clean.filter((entry) => !actual.clean.includes(entry)).map((entry) => improvement(`  clean document lost: ${entry}`));
  return combine([...recall, ...gained, ...lost]);
};

/** Sets that still have an expected.json but no manifest.json: a set that disappeared without its record. */
export const setsWithoutManifest = (withExpected: readonly string[], withManifest: readonly string[]): string[] =>
  withExpected.filter((set) => !withManifest.includes(set)).toSorted((left, right) => left.localeCompare(right, "en"));

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
