import { checkSource, type SourceCheck } from "../check-source.ts";
import type { Allowed } from "../compare/outcome.ts";
import { missingSections } from "../detectors/team.ts";
import { uiLanguageOf, type UiLanguage } from "../ui.ts";
import { findingOf } from "./finding.ts";
import { citationsAgainst, factsAgainst, OUTPUT_PATH, type CitationsRead, type ItemReading } from "./checks.ts";
import { contextsAgainst, type ContextsRead } from "./contexts.ts";
import type { GradeItem } from "./item.ts";
import { ratesOf, sizeOf, type OutputSize } from "./rates.ts";
import type { GradeCitations, GradeFacts, GradeFinding, GradeResult, GradeScore, NotRunEntry, Stamp } from "./result.ts";
import type { Rubric } from "./rubric.ts";
import { rubricVerdict } from "./rubric-verdict.ts";
import type { GradeSettings } from "./stamp.ts";
import { GRADE_TEXT } from "./text.ts";
import { aiScoreOfDocument } from "../ai-score/of-document.ts";
import { gradeAiScoreOf } from "./ai-score.ts";
import { defaultVerdict, type Verdict } from "./verdict.ts";

/** One run's settings, its `grade:` rubric when chaff.yaml has one, and its stamp, which every result carries. */
export type GradeSetup = GradeSettings & { readonly stamp: Stamp; readonly rubric?: Rubric | undefined };

/** The fact kinds the rubric lets change (`allow_dropped`, `allow_added`), as compare's --allow-dropped and --allow-added. */
const allowedBy = (rubric: Rubric | undefined): Allowed => ({
  dropped: new Set(rubric?.facts?.allowDropped ?? []),
  added: new Set(rubric?.facts?.allowAdded ?? []),
});

/** One output as read: linted, measured, and checked against its reference and sources. */
type Checked = {
  readonly check: SourceCheck;
  readonly ui: UiLanguage;
  readonly findings: readonly GradeFinding[];
  readonly size: OutputSize;
  readonly facts: GradeFacts | null;
  readonly cited: CitationsRead | undefined;
  readonly contexts: ContextsRead | undefined;
};

const checkItem = async (item: GradeItem, setup: GradeSetup): Promise<Checked> => {
  const choice = { language: item.language, genre: item.genre ?? setup.genre, experimental: setup.experimental };
  const check = await checkSource(OUTPUT_PATH, item.output, setup.config, choice);
  const ui = uiLanguageOf(check.language);
  const reading: ItemReading = { genre: check.genre.genre, config: setup.config };
  const texts = { reference: item.reference ?? "", output: item.output, outputLanguage: check.language };
  return {
    check,
    ui,
    findings: check.applied.kept.map((finding) => findingOf(finding, check)),
    size: sizeOf(check.doc),
    facts: item.reference === undefined ? null : await factsAgainst(texts, reading, allowedBy(setup.rubric)),
    cited: item.citations === undefined ? undefined : await citationsAgainst(item, item.citations, reading, ui),
    contexts: await contextsOf(item, check.language, reading, setup.rubric),
  };
};

const contextsOf = async (item: GradeItem, outputLanguage: string, reading: ItemReading, rubric: Rubric | undefined): Promise<ContextsRead | undefined> => {
  if (item.contexts === undefined) return undefined;
  const texts = { output: item.output, outputPath: OUTPUT_PATH, outputLanguage, contexts: item.contexts };
  return contextsAgainst(texts, reading, new Set(rubric?.contexts?.allowUnsupported ?? []));
};

/** What the contexts check could not see: not given at all, kinds not fully read, and sentences with nothing to check. */
const contextsNotRun = (checked: Checked): NotRunEntry[] => {
  const text = GRADE_TEXT[checked.ui];
  if (checked.contexts === undefined) return [{ rule: "contexts", reason: text.noContexts }];
  const { contexts, unread } = checked.contexts;
  return [
    ...unread.map((entry) => ({ rule: "contexts", reason: text.contextsUnread(entry.kind, entry.reason) })),
    ...(contexts.uncheckedSentences === 0 ? [] : [{ rule: "contexts", reason: text.uncheckedSentences(contexts.uncheckedSentences) }]),
  ];
};

const citationsOf = (checked: Checked): GradeCitations | null => (checked.cited !== undefined && "citations" in checked.cited ? checked.cited.citations : null);

/** The rubric's rules this output's rules do not include: a misspelt id would otherwise pass every output silently. */
const unknownRubricRules = (checked: Checked, rubric: Rubric | undefined): NotRunEntry[] =>
  Object.keys(rubric?.rules ?? {})
    .filter((id) => !checked.check.rules.some((rule) => rule.id === id))
    .map((rule) => ({ rule, reason: GRADE_TEXT[checked.ui].unknownRule }));

const notRunOf = (checked: Checked, rubric: Rubric | undefined): NotRunEntry[] => [
  ...checked.check.raw.skipped.map((skipped) => ({ rule: skipped.rule, reason: skipped.why })),
  ...unknownRubricRules(checked, rubric),
  ...(checked.facts === null ? [{ rule: "compare", reason: GRADE_TEXT[checked.ui].noReference }] : []),
  ...(checked.cited === undefined ? [{ rule: "cite", reason: GRADE_TEXT[checked.ui].noCitations }] : []),
  ...(checked.cited !== undefined && "notRun" in checked.cited ? [checked.cited.notRun] : []),
  ...contextsNotRun(checked),
];

/** Pass or fail: by the rubric when chaff.yaml has `grade:`, with its penalty score; else by the default of spec §29.3. */
const judge = (item: GradeItem, checked: Checked, setup: GradeSetup): { readonly verdict: Verdict; readonly score?: GradeScore } => {
  const graded = { findings: checked.findings, facts: checked.facts, citations: citationsOf(checked), contexts: checked.contexts?.contexts };
  if (setup.rubric === undefined) return { verdict: defaultVerdict(graded) };
  const wanted = setup.rubric.requiredSections ?? checked.check.doc.requiredSections;
  const uncited = Object.keys(item.sources).length > 0 && item.citations === undefined;
  return rubricVerdict({ ...graded, size: checked.size, missingSections: missingSections(checked.check.doc, wanted), uncited }, setup.rubric);
};

/** Grades one output (spec §29.3): its findings and their rates, the facts against its reference, its quotations, and pass or fail. */
export const gradeItem = async (item: GradeItem, setup: GradeSetup): Promise<GradeResult> => {
  const checked = await checkItem(item, setup);
  const { verdict, score } = judge(item, checked, setup);
  return {
    id: item.id,
    ...(item.variant === undefined ? {} : { variant: item.variant }),
    language: checked.check.language,
    genre: checked.check.genre.genre,
    size: checked.size,
    findings: checked.findings,
    rates: ratesOf(
      checked.findings.map((finding) => finding.rule),
      checked.size,
    ),
    notRun: notRunOf(checked, setup.rubric),
    facts: checked.facts,
    citations: citationsOf(checked),
    ...(checked.contexts === undefined ? {} : { contexts: checked.contexts.contexts }),
    ...(score === undefined ? {} : { score }),
    aiScore: gradeAiScoreOf(aiScoreOfDocument(checked.check.doc, checked.check.rules, checked.check.genre.genre)),
    pass: verdict.pass,
    failedBecause: verdict.failedBecause,
    stamp: setup.stamp,
  };
};
