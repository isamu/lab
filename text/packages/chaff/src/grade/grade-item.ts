import { checkSource, documentLanguage, type SourceCheck } from "../check-source.ts";
import type { Config } from "../config/load.ts";
import { outcomeOf } from "../compare/outcome.ts";
import { factsOf } from "../commands/compare.ts";
import { documentFromSource } from "../commands/read-document.ts";
import { treeFromSource } from "../commands/tree.ts";
import { messageOf } from "../render/text.ts";
import { checkCitations, type CitationResult } from "../structure/cite.ts";
import { uiLanguageOf } from "../ui.ts";
import type { Finding, StructureNode } from "../plugin.ts";
import type { GradeCitation, GradeItem } from "./item.ts";
import { ratesOf, sizeOf } from "./rates.ts";
import type { FailedCitation, GradeCitations, GradeFact, GradeFacts, GradeFinding, GradeResult, NotRunEntry, Stamp } from "./result.ts";
import type { GradeSettings } from "./stamp.ts";
import { GRADE_TEXT } from "./text.ts";
import { defaultVerdict } from "./verdict.ts";

/** One run's settings, and its stamp, which every result carries. */
export type GradeSetup = GradeSettings & { readonly stamp: Stamp };

// The texts are read from memory, under names that say which part of the item each one is.
const OUTPUT_PATH = "output.md";
const REFERENCE_PATH = "reference.md";
const READ_AS_NAMED = /\.(?:md|markdown|mdx|txt)$/iu;

/** A source is Markdown unless its name says it is a plain text file (a contract without headings, read by its numbering). */
export const sourcePathOf = (name: string): string => (READ_AS_NAMED.test(name) ? name : `${name}.md`);

const findingOf = (finding: Finding, check: SourceCheck): GradeFinding => {
  const rule = check.rules.find((entry) => entry.id === finding.rule);
  return {
    rule: finding.rule,
    level: finding.severity,
    line: finding.line,
    column: finding.column,
    message: rule === undefined ? finding.rule : messageOf(rule, finding, check.language),
  };
};

/** The genre and how this run reads every text of one item: the output's genre, so a source's profile follows the task. */
type ItemReading = { readonly genre: string; readonly config: Config };

const factOf = (change: GradeFact): GradeFact => ({ kind: change.kind, key: change.key, text: change.text, line: change.line, allowed: change.allowed });

/** `compare`'s outcome, the reference before and the output after, read as `chaff compare` reads two files. */
const factsAgainst = async (reference: string, output: string, outputLanguage: string, reading: ItemReading): Promise<GradeFacts> => {
  const { config, genre } = reading;
  const names = config.names;
  const before = await documentFromSource(REFERENCE_PATH, reference, { language: documentLanguage(REFERENCE_PATH, reference, config), genre }, config, true);
  const after = await documentFromSource(OUTPUT_PATH, output, { language: outputLanguage, genre }, config, true);
  const outcome = outcomeOf(factsOf(REFERENCE_PATH, before, names), factsOf(OUTPUT_PATH, after, names));
  return { dropped: outcome.dropped.map(factOf), added: outcome.added.map(factOf), reformed: outcome.reformed.length };
};

type SourceTreeRead = { readonly tree: StructureNode } | { readonly language: string };

const sourceTree = async (name: string, text: string, reading: ItemReading): Promise<SourceTreeRead> => {
  const path = sourcePathOf(name);
  const language = documentLanguage(path, text, reading.config);
  const tree = await treeFromSource(path, text, language, reading.genre, reading.config);
  return tree === undefined ? { language } : { tree };
};

const failedOf = (source: string, result: CitationResult): FailedCitation[] =>
  result.status === "ok"
    ? []
    : [{ source, address: result.citation.address, quote: result.citation.quote, status: result.status, foundAt: result.foundAt, line: result.line }];

type CitationsRead = { readonly citations: GradeCitations } | { readonly notRun: NotRunEntry };

/** Each citation checked against the source it names, as `chaff cite` checks it. A source chaff cannot read as a tree is not a failed quotation. */
const citationsAgainst = async (item: GradeItem, citations: readonly GradeCitation[], reading: ItemReading, ui: "ja" | "en"): Promise<CitationsRead> => {
  const names = [...new Set(citations.map((citation) => citation.source))];
  const trees = await Promise.all(names.map(async (name) => ({ name, read: await sourceTree(name, item.sources[name] ?? "", reading) })));
  const unread = trees.find((entry) => !("tree" in entry.read));
  if (unread !== undefined && "language" in unread.read)
    return { notRun: { rule: "cite", reason: GRADE_TEXT[ui].noStructure(unread.name, unread.read.language) } };
  const failed = trees.flatMap(({ name, read }) => {
    if (!("tree" in read)) return [];
    const own = citations.filter((citation) => citation.source === name);
    return checkCitations(item.sources[name] ?? "", read.tree, own).flatMap((result) => failedOf(name, result));
  });
  return { citations: { checked: citations.length, failed } };
};

const notRunOf = (check: SourceCheck): NotRunEntry[] => check.raw.skipped.map((skipped) => ({ rule: skipped.rule, reason: skipped.why }));

/** Grades one output (spec §29.3): its findings and their rates, the facts against its reference, its quotations, and pass or fail. */
export const gradeItem = async (item: GradeItem, setup: GradeSetup): Promise<GradeResult> => {
  const check = await checkSource(OUTPUT_PATH, item.output, setup.config, {
    language: item.language,
    genre: item.genre ?? setup.genre,
    experimental: setup.experimental,
  });
  const ui = uiLanguageOf(check.language);
  const reading = { genre: check.genre.genre, config: setup.config };
  const findings = check.applied.kept.map((finding) => findingOf(finding, check));
  const size = sizeOf(check.doc);
  const facts = item.reference === undefined ? null : await factsAgainst(item.reference, item.output, check.language, reading);
  const cited = item.citations === undefined ? undefined : await citationsAgainst(item, item.citations, reading, ui);
  const citations = cited !== undefined && "citations" in cited ? cited.citations : null;
  const notRun = [
    ...notRunOf(check),
    ...(facts === null ? [{ rule: "compare", reason: GRADE_TEXT[ui].noReference }] : []),
    ...(cited === undefined ? [{ rule: "cite", reason: GRADE_TEXT[ui].noCitations }] : []),
    ...(cited !== undefined && "notRun" in cited ? [cited.notRun] : []),
  ];
  const verdict = defaultVerdict({ findings, facts, citations });
  return {
    id: item.id,
    language: check.language,
    genre: check.genre.genre,
    size,
    findings,
    rates: ratesOf(
      findings.map((finding) => finding.rule),
      size,
    ),
    notRun,
    facts,
    citations,
    pass: verdict.pass,
    failedBecause: verdict.failedBecause,
    stamp: setup.stamp,
  };
};
