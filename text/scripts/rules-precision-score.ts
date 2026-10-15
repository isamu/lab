// The numbers behind `yarn rules:precision`: of a rule's findings that someone judged in the chaff-corpus repository
// (isamu/chaff-corpus, expected/<id>.yaml), how many were right, per genre group and language. Pure;
// scripts/rules-precision.ts runs the corpus and reads the files.

export type Verdict = "correct" | "false-positive" | "unjudged";

/** A finding chaff gives today, in a document of one group and language, with its verdict. */
export type CountedFinding = { readonly document: string; readonly group: string; readonly language: string; readonly rule: string; readonly verdict: Verdict };

/**
 * One rule's findings in one group and language: the right ones and the false positives, the documents those judged
 * findings are on, and the findings nobody has judged yet (they decide nothing but say the rule reports there).
 */
export type LanguagePrecision = { readonly correct: number; readonly falsePositive: number; readonly documents: number; readonly unjudged: number };

/** Per language, for one rule in one group. */
export type GroupPrecision = Readonly<Record<string, LanguagePrecision>>;

/** corpus: the chaff-corpus commit the verdicts come from. rules: rule, then group, then language. */
export type PrecisionMeasurement = {
  readonly corpus: string;
  readonly rules: Readonly<Record<string, Readonly<Record<string, GroupPrecision>>>>;
};

/** What the corpus runner (`--json`) says became of one expected entry or one finding. */
export type CorpusOutcome = { readonly kind: string; readonly rule: string; readonly line: number; readonly text?: string; readonly sha256?: string };
export type CorpusResult = { readonly id: string; readonly genre: string; readonly language: string; readonly outcomes: readonly CorpusOutcome[] };

/** One entry of expected/<id>.yaml, as far as it decides whether the verdict counts. */
export type ExpectedNote = {
  readonly document: string;
  readonly rule: string;
  readonly line: number;
  readonly text?: string;
  readonly sha256?: string;
  readonly note?: string;
};

/**
 * A verdict whose note blames the document, not chaff: a PDF's extracted text that runs clauses together, or a dataset
 * that cuts the text short. It says nothing about the rule on a real document, so it is not counted at all.
 */
export const ARTEFACT_NOTE = /^(?:extraction|dataset) artefact:/u;

const keyOf = (document: string, entry: { readonly rule: string; readonly line: number; readonly text?: string; readonly sha256?: string }): string =>
  JSON.stringify([document, entry.rule, entry.line, entry.text ?? entry.sha256 ?? ""]);

/** The entries whose verdict is about the document's extraction, by the key the runner's outcomes are matched on. */
export const artefactKeys = (notes: readonly ExpectedNote[]): Set<string> =>
  new Set(notes.filter((entry) => entry.note !== undefined && ARTEFACT_NOTE.test(entry.note)).map((entry) => keyOf(entry.document, entry)));

/** The runner's outcomes for a finding chaff still gives. Gone entries and misses are not findings of this run. */
const PRESENT: Readonly<Record<string, Verdict>> = {
  "correct-kept": "correct",
  "false-positive-present": "false-positive",
  "unjudged-present": "unjudged",
  new: "unjudged",
};

const groupOf = (genre: string): string => genre.split("/")[0] ?? genre;

/** Every finding of the run with its verdict, less those whose verdict is an extraction artefact. */
export const countedFindings = (results: readonly CorpusResult[], artefacts: ReadonlySet<string>): CountedFinding[] =>
  results.flatMap((result) =>
    result.outcomes.flatMap((outcome) => {
      const verdict = PRESENT[outcome.kind];
      if (verdict === undefined || artefacts.has(keyOf(result.id, outcome))) return [];
      return [{ document: result.id, group: groupOf(result.genre), language: result.language, rule: outcome.rule, verdict }];
    }),
  );

const byId = (left: string, right: string): number => left.localeCompare(right, "en");

type Tally = { readonly correct: number; readonly falsePositive: number; readonly unjudged: number; readonly documents: ReadonlySet<string> };

const EMPTY: Tally = { correct: 0, falsePositive: 0, unjudged: 0, documents: new Set() };

const plus = (tally: Tally, finding: CountedFinding): Tally => ({
  correct: tally.correct + (finding.verdict === "correct" ? 1 : 0),
  falsePositive: tally.falsePositive + (finding.verdict === "false-positive" ? 1 : 0),
  unjudged: tally.unjudged + (finding.verdict === "unjudged" ? 1 : 0),
  documents: finding.verdict === "unjudged" ? tally.documents : new Set([...tally.documents, finding.document]),
});

const tallied = (findings: readonly CountedFinding[]): Map<string, Tally> =>
  findings.reduce((tallies, finding) => {
    const key = JSON.stringify([finding.rule, finding.group, finding.language]);
    return tallies.set(key, plus(tallies.get(key) ?? EMPTY, finding));
  }, new Map<string, Tally>());

const isKey = (value: unknown): value is [string, string, string] =>
  Array.isArray(value) && value.length === 3 && value.every((part) => typeof part === "string");

/** rule → group → language, each level in id order. A rule with no finding is absent. */
export const groupPrecisions = (findings: readonly CountedFinding[]): Record<string, Record<string, Record<string, LanguagePrecision>>> =>
  [...tallied(findings).entries()]
    .toSorted(([left], [right]) => byId(left, right))
    .reduce<Record<string, Record<string, Record<string, LanguagePrecision>>>>((rules, [key, tally]) => {
      const parsed: unknown = JSON.parse(key);
      if (!isKey(parsed)) return rules;
      const [rule, group, language] = parsed;
      const counts = { correct: tally.correct, falsePositive: tally.falsePositive, documents: tally.documents.size, unjudged: tally.unjudged };
      const groups = rules[rule] ?? {};
      return { ...rules, [rule]: { ...groups, [group]: { ...groups[group], [language]: counts } } };
    }, {});

/** correct / judged, or undefined when nothing is judged. */
export const precisionOf = (counts: Pick<LanguagePrecision, "correct" | "falsePositive">): number | undefined => {
  const judged = counts.correct + counts.falsePositive;
  return judged === 0 ? undefined : counts.correct / judged;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const isCount = (value: unknown): value is number => Number.isInteger(value) && typeof value === "number" && value >= 0;

const isLanguagePrecision = (value: unknown): value is LanguagePrecision =>
  isRecord(value) && isCount(value["correct"]) && isCount(value["falsePositive"]) && isCount(value["documents"]) && isCount(value["unjudged"]);

const isGroupPrecision = (value: unknown): value is GroupPrecision => isRecord(value) && Object.values(value).every(isLanguagePrecision);

const isGroups = (value: unknown): value is Record<string, GroupPrecision> => isRecord(value) && Object.values(value).every(isGroupPrecision);

export const isPrecisionMeasurement = (value: unknown): value is PrecisionMeasurement =>
  isRecord(value) && typeof value["corpus"] === "string" && isRecord(value["rules"]) && Object.values(value["rules"]).every(isGroups);
