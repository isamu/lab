// The numbered runs a schedule writes as 第N回, 第N週, Week N or Session N (lexicon ordinal-frame), in the first cell of
// table rows, at the start of list items or at the start of lines, and the places where such a run skips or repeats a
// number. Pure: the frames come from the lexicon, the leads from the caller.
import type { Lexicon } from "../plugin.ts";
import type { StructureIssue } from "./issues.ts";

/** One frame of the lexicon: the form with its number, and the form's opening followed by a figure. */
export type OrdinalFrame = { readonly group: string; readonly written: RegExp; readonly opened: RegExp | undefined };

/** A lead that carries a frame: its number (or the first and last of a joined 1-2) as written. */
export type FramedNumber = { readonly group: string; readonly ordinal: number; readonly last: number; readonly label: string };

/** A lead that opens a frame (第2, Week 3) without the form being readable (第2・第3回): it ends the group's run. */
export type UnreadableFrame = { readonly group: string; readonly unreadable: true };

/** Where a lead starts and what it reads as. */
export type Lead = { readonly offset: number; readonly read: readonly (FramedNumber | UnreadableFrame)[] };

const PLACEHOLDER = "{n}";
const FIGURES = "[0-9０-９]{1,3}";
const JOINER = "[ \\t]?[-–—~〜～・,、][ \\t]?";
const FOLLOWER = "(?=$|[\\s\\u3000:：|（(.)）\\]\\-–—、,*_])";
const SPACE = /[ \t\u3000]+/gu;
const FULLWIDTH_ZERO = 0xff10;

const escaped = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&").replace(SPACE, "[ \\t\\u3000]*");

const frameOf = (pattern: string, group: string): OrdinalFrame | undefined => {
  const at = pattern.indexOf(PLACEHOLDER);
  if (at === -1) return undefined;
  const opening = escaped(pattern.slice(0, at));
  const closing = escaped(pattern.slice(at + PLACEHOLDER.length));
  const written = new RegExp(`^${opening}(?<first>${FIGURES})(?:${JOINER}(?<last>${FIGURES}))?${closing}${FOLLOWER}`, "iu");
  return { group, written, opened: opening === "" ? undefined : new RegExp(`^${opening}[0-9０-９]`, "iu") };
};

/** The lexicon's frames. An entry without {n} or without a group is not a frame. */
export const ordinalFramesOf = (lexicon: Lexicon): OrdinalFrame[] =>
  lexicon.flatMap((entry) => {
    const frame = entry.group === undefined ? undefined : frameOf(entry.pattern, entry.group);
    return frame === undefined ? [] : [frame];
  });

const figureValue = (figures: string): number =>
  Number([...figures].map((char) => (char >= "０" && char <= "９" ? String(char.charCodeAt(0) - FULLWIDTH_ZERO) : char)).join(""));

const readFrame = (lead: string, frame: OrdinalFrame): FramedNumber | UnreadableFrame | undefined => {
  const found = frame.written.exec(lead);
  if (found === null) return frame.opened?.test(lead) === true ? { group: frame.group, unreadable: true } : undefined;
  const ordinal = figureValue(found.groups?.["first"] ?? "");
  const last = found.groups?.["last"];
  return { group: frame.group, ordinal, last: last === undefined ? ordinal : figureValue(last), label: found[0].trim() };
};

/** What the text at the start of a lead reads as, under each frame that matches it. */
export const framesAt = (lead: string, frames: readonly OrdinalFrame[]): Lead["read"] => {
  const read = frames.flatMap((frame) => readFrame(lead, frame) ?? []);
  const groups = new Set(read.filter((each) => !("unreadable" in each)).map((each) => each.group));
  return read.filter((each) => !("unreadable" in each) || !groups.has(each.group));
};

/** One number of a run, and where its lead starts. */
export type RunNumber = FramedNumber & { readonly offset: number };

/**
 * The leads of one block (one table, one list, one section's lines), cut into runs per group. An unreadable lead ends its
 * group's run, and a number 1 starts a new one (a second term counting again).
 */
export const ordinalRuns = (leads: readonly Lead[]): RunNumber[][] => {
  const runs: RunNumber[][] = [];
  const open = new Map<string, RunNumber[]>();
  leads.forEach((lead) =>
    lead.read.forEach((read) => {
      if ("unreadable" in read) {
        open.delete(read.group);
        return;
      }
      const openRun = open.get(read.group) ?? [];
      const run = read.ordinal === 1 && openRun.length > 0 ? [] : openRun;
      if (run.length === 0) runs.push(run);
      open.set(read.group, run);
      run.push({ ...read, offset: lead.offset });
    }),
  );
  return runs;
};

/** A run shorter than this is too short to tell a numbering from a mention. */
const SHORTEST_RUN = 3;

const followsOn = (current: FramedNumber, previous: FramedNumber): boolean => current.ordinal === previous.last + 1;

/**
 * Each number in the run that does not follow the one before it: a skip or a repeat. A run
 * where fewer than half the steps follow on lists chosen numbers (weeks 2, 5, 9), not a sequence, and is not read; so
 * is a run shorter than three, and a run writing one number throughout.
 */
export const ordinalRunBreaks = (run: readonly RunNumber[]): StructureIssue[] => {
  if (run.length < SHORTEST_RUN || new Set(run.map((item) => item.ordinal)).size < 2) return [];
  const steps = run.slice(1).map((item, index) => ({ item, previous: run[index] ?? item }));
  const breaks = steps.filter(({ item, previous }) => !followsOn(item, previous));
  if (breaks.length * 2 > steps.length) return [];
  return breaks.map(({ item, previous }) => ({
    offset: item.offset,
    values: { previous: previous.label, label: item.label, expected: previous.last + 1, found: item.ordinal },
  }));
};
