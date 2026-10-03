import type { CrossDetector, DetectorOptions, DocumentFinding, Finding, Level, ProseDocument, RuleDefinition } from "./plugin.ts";
import { levelFor, limitFor, place, type RunContext, type RunResult, type Skipped } from "./run.ts";
import { presetLevels } from "./genre-load.ts";
import { severityAt } from "./levels.ts";
import { lineStarts } from "./position.ts";
import { REASONS } from "./reasons.ts";
import { uiLanguageOf } from "./ui.ts";
import { byPosition } from "./finding-order.ts";
import { optionValues, settleOptions } from "./rule-options.ts";

// The second pass of a run over several files: the rules that compare documents (requires: [documents]). The first pass,
// run on each document alone, gates them as it gates any rule (language, level, tags, Markdown) and, when nothing else
// stops them, sets them aside with the reason oneDocument. Here every document that set a rule aside takes part in it.

/** One document of the run, with what its own pass found and the settings it ran with. */
export type CrossInput = {
  readonly doc: ProseDocument;
  readonly rules: readonly RuleDefinition[];
  readonly context: RunContext;
  readonly raw: RunResult;
};

const oneDocumentReason = (doc: ProseDocument): string => REASONS[uiLanguageOf(doc.language)].oneDocument;

/** The rules the document's own pass set aside for this one: everything but the number of documents let them run. */
const waitingRules = (input: CrossInput): string[] =>
  input.raw.skipped.filter((entry) => entry.why === oneDocumentReason(input.doc)).map((entry) => entry.rule);

const isOn = (level: Level): level is Exclude<Level, "off"> => level !== "off";

/** The rule's level for this document. A rule set aside was not off, so off does not come back here; it reads as normal. */
const levelOf = (input: CrossInput, rule: RuleDefinition): Exclude<Level, "off"> => {
  const level = levelFor(rule, input.context.settings, input.context.experimental, presetLevels(input.context.genre));
  return isOn(level) ? level : "normal";
};

/** The options a detector gets: those of the first document taking part, the way a single document's pass builds them. */
const optionsFor = (input: CrossInput, rule: RuleDefinition): DetectorOptions => ({
  limit: limitFor(rule, levelOf(input, rule), input.context.genre, input.context.limits ?? {}),
  lexicon: rule.word_list === undefined ? undefined : input.doc.lexicons[rule.word_list],
  where: rule.where,
  ...(rule.options === undefined ? {} : { settings: optionValues(settleOptions(rule.id, rule.options, input.context.optionLayers ?? [])) }),
});

/** What one rule did to the documents taking part (by path): its findings, or why it did not run after all. */
type RuleOutcome = {
  readonly rule: string;
  readonly paths: ReadonlySet<string>;
  readonly findings: readonly DocumentFinding[];
  readonly skip?: string;
};

const ruleOf = (input: CrossInput, id: string): RuleDefinition | undefined => input.rules.find((rule) => rule.id === id);

const runRule = (id: string, participants: readonly CrossInput[], detectors: Readonly<Record<string, CrossDetector>>): RuleOutcome | undefined => {
  const [first] = participants;
  const rule = first === undefined ? undefined : ruleOf(first, id);
  // One document taking part has nothing to be compared with: the reason it was set aside stays the reason.
  if (first === undefined || rule === undefined || participants.length < 2) return undefined;
  const paths = new Set(participants.map((input) => input.doc.path));
  const detector = detectors[rule.how_to_find];
  if (detector === undefined) return { rule: id, paths, findings: [], skip: REASONS[uiLanguageOf(first.doc.language)].noDetector(rule.how_to_find) };
  const found = detector(
    participants.map((input) => input.doc),
    optionsFor(first, rule),
  );
  return { rule: id, paths, findings: found };
};

/** The rule's findings in one document, placed (line and column) and at that document's severity for the rule. */
const placedIn = (input: CrossInput, outcome: RuleOutcome): Finding[] => {
  const rule = ruleOf(input, outcome.rule);
  if (rule === undefined) return [];
  const starts = lineStarts(input.doc.source);
  const severity = severityAt(rule, levelOf(input, rule), input.context.genre);
  return outcome.findings.filter((entry) => entry.path === input.doc.path).map((entry) => place(starts, { ...entry.finding, rule: rule.id, severity }));
};

/** The document's results with the rules it took part in: their findings added, and the reason they were set aside gone. */
const withOutcomes = (input: CrossInput, outcomes: readonly RuleOutcome[]): RunResult => {
  const mine = outcomes.filter((outcome) => outcome.paths.has(input.doc.path));
  if (mine.length === 0) return input.raw;
  const decided = new Set(mine.map((outcome) => outcome.rule));
  const skipped: Skipped[] = [
    ...input.raw.skipped.filter((entry) => !(decided.has(entry.rule) && entry.why === oneDocumentReason(input.doc))),
    ...mine.flatMap((outcome) => (outcome.skip === undefined ? [] : [{ rule: outcome.rule, why: outcome.skip }])),
  ];
  const added = mine.flatMap((outcome) => placedIn(input, outcome));
  return { ...input.raw, findings: [...input.raw.findings, ...added].toSorted(byPosition), skipped };
};

/**
 * Runs the rules that compare documents over the documents of one run, and returns each document's results with
 * them in, in the order given. A rule that only one document took part in keeps that document's reason, oneDocument.
 */
export const runCrossRules = (inputs: readonly CrossInput[], detectors: Readonly<Record<string, CrossDetector>>): RunResult[] => {
  const ids = [...new Set(inputs.flatMap(waitingRules))];
  const outcomes = ids.flatMap((id) => {
    const outcome = runRule(
      id,
      inputs.filter((input) => waitingRules(input).includes(id)),
      detectors,
    );
    return outcome === undefined ? [] : [outcome];
  });
  return inputs.map((input) => withOutcomes(input, outcomes));
};
