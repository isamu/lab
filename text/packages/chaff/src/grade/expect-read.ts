import { documentLanguage } from "../check-source.ts";
import { factsOf } from "../commands/compare.ts";
import { documentFromSource } from "../commands/read-document.ts";
import type { Compared } from "../compare/outcome.ts";
import { resolveGenre } from "../resolve-genre.ts";
import { OUTPUT_PATH, type ItemReading } from "./checks.ts";
import { EXPECT_LISTS, entryPath, expectAgainst, factOfEntry, type GradeExpect, type GradeExpectResult, type ReadEntry } from "./expect.ts";
import type { GradeItem, ItemProblem } from "./item.ts";

// An item's `expect` entries read as compare reads a document, in the output's language and genre, so an entry and
// the output spell one fact alike.

const ENTRY_PATH = "expect.md";

type EntryRead = { readonly entry: ReadEntry } | { readonly problem: Omit<ItemProblem, "line"> };

const readEntry = async (list: ReadEntry["list"], index: number, entry: string, reading: ItemReading & { readonly language: string }): Promise<EntryRead> => {
  const prose = await documentFromSource(ENTRY_PATH, entry, { language: reading.language, genre: reading.genre }, reading.config, true);
  const facts = factsOf(ENTRY_PATH, prose, reading.config.names ?? []);
  const found = factOfEntry(entry, facts.extraction.atoms);
  if ("unread" in found)
    return { problem: { kind: found.unread === "no-fact" ? "expect-no-fact" : "expect-several-facts", detail: `${entryPath(list, index)} ${entry}` } };
  return { entry: { list, index, entry, read: { path: ENTRY_PATH, extraction: { ...facts.extraction, atoms: [found.fact] } } } };
};

const readEntries = (expect: GradeExpect, reading: ItemReading & { readonly language: string }): Promise<EntryRead[]> =>
  Promise.all(EXPECT_LISTS.flatMap((list) => expect[list].map((entry, index) => readEntry(list, index, entry, reading))));

/** The output's own facts, read as `chaff compare` reads the document after. */
const outputFacts = async (output: string, reading: ItemReading & { readonly language: string }): Promise<Compared> => {
  const prose = await documentFromSource(OUTPUT_PATH, output, { language: reading.language, genre: reading.genre }, reading.config, true);
  return factsOf(OUTPUT_PATH, prose, reading.config.names ?? []);
};

/** The language and genre the output is graded in, as checkSource chooses them. */
const itemReading = (item: GradeItem, setup: { readonly config: ItemReading["config"]; readonly genre?: string | undefined }) => ({
  config: setup.config,
  language: item.language ?? documentLanguage(OUTPUT_PATH, item.output, setup.config),
  genre: resolveGenre(OUTPUT_PATH, item.output, setup.config, item.genre ?? setup.genre).genre,
});

/** Each entry chaff cannot read as exactly one fact, on the item's line: the run stops before grading (exit 2). */
export const expectProblems = async (
  item: GradeItem,
  line: number,
  setup: { readonly config: ItemReading["config"]; readonly genre?: string | undefined },
): Promise<ItemProblem[]> => {
  if (item.expect === undefined) return [];
  const read = await readEntries(item.expect, itemReading(item, setup));
  return read.flatMap((entry) => ("problem" in entry ? [{ ...entry.problem, line }] : []));
};

/**
 * The output against the item's expect, read in the language and genre it was graded in. Throws for an entry that is
 * not one fact: `chaff grade` refuses such an item before grading (expectProblems), so none reaches here.
 */
export const expectOfItem = async (item: GradeItem, reading: ItemReading & { readonly language: string }): Promise<GradeExpectResult | undefined> => {
  if (item.expect === undefined) return undefined;
  const read = await readEntries(item.expect, reading);
  const entries = read.flatMap((entry) => {
    if ("problem" in entry) throw new Error(`${item.id}: ${entry.problem.detail ?? ""} is not one fact`);
    return [entry.entry];
  });
  return expectAgainst(entries, await outputFacts(item.output, reading));
};
