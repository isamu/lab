import { documentLanguage } from "../check-source.ts";
import type { Config } from "../config/load.ts";
import { outcomeOf, type Allowed } from "../compare/outcome.ts";
import { factsOf } from "../commands/compare.ts";
import { documentFromSource } from "../commands/read-document.ts";
import { treeFromSource } from "../commands/tree.ts";
import { checkCitations, type CitationResult } from "../structure/cite.ts";
import type { StructureNode } from "../plugin.ts";
import type { UiLanguage } from "../ui.ts";
import type { GradeCitation, GradeItem } from "./item.ts";
import type { FailedCitation, GradeCitations, GradeFact, GradeFacts, NotRunEntry } from "./result.ts";
import { GRADE_TEXT } from "./text.ts";

// What an output is checked against besides the rules: its reference (compare) and its sources (cite). Each is read from
// memory through the same code as `chaff compare` and `chaff cite` read files.

/** The output is read under this name, so it is Markdown as a model's answer usually is. */
export const OUTPUT_PATH = "output.md";
const REFERENCE_PATH = "reference.md";
const READ_AS_NAMED = /\.(?:md|markdown|mdx|txt)$/iu;

/** A source is Markdown unless its name says it is a plain text file (a contract without headings, read by its numbering). */
export const sourcePathOf = (name: string): string => (READ_AS_NAMED.test(name) ? name : `${name}.md`);

/** The settings, and the output's genre, which every text of one item is read with, so a source's profile follows the task. */
export type ItemReading = { readonly genre: string; readonly config: Config };

const factOf = (change: GradeFact): GradeFact => ({ kind: change.kind, key: change.key, text: change.text, line: change.line, allowed: change.allowed });

/** `compare`'s outcome, the reference before and the output after, read as `chaff compare` reads two files. */
export const factsAgainst = async (
  texts: { readonly reference: string; readonly output: string; readonly outputLanguage: string },
  reading: ItemReading,
  allowed: Allowed,
): Promise<GradeFacts> => {
  const { config, genre } = reading;
  const referenceLanguage = documentLanguage(REFERENCE_PATH, texts.reference, config);
  const before = await documentFromSource(REFERENCE_PATH, texts.reference, { language: referenceLanguage, genre }, config, true);
  const after = await documentFromSource(OUTPUT_PATH, texts.output, { language: texts.outputLanguage, genre }, config, true);
  const outcome = outcomeOf(factsOf(REFERENCE_PATH, before, config.names), factsOf(OUTPUT_PATH, after, config.names), allowed);
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

export type CitationsRead = { readonly citations: GradeCitations } | { readonly notRun: NotRunEntry };

/** Each citation checked against the source it names, as `chaff cite` checks it. A source chaff cannot read as a tree is not a failed quotation. */
export const citationsAgainst = async (item: GradeItem, citations: readonly GradeCitation[], reading: ItemReading, ui: UiLanguage): Promise<CitationsRead> => {
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
