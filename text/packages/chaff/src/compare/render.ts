import { ATOM_KINDS, type Atom, type AtomKind } from "./atom.ts";
import type { Reformed } from "./match.ts";
import type { Change, Outcome, Side } from "./outcome.ts";
import type { CompareText } from "./text.ts";
import { unwrappedText } from "./unwrapped.ts";

/** How much of a fact is shown: a code block is shown by its first line. */
const SHOWN_WIDTH = 60;

/** One line of a fact as written: a code block or a wrapped quotation is shown on one line, cut at SHOWN_WIDTH. */
const shown = (text: string): string => {
  const oneLine = unwrappedText(text).trim();
  return oneLine.length > SHOWN_WIDTH ? `${oneLine.slice(0, SHOWN_WIDTH)}…` : oneLine;
};

const totalOf = (side: Side): number => ATOM_KINDS.reduce((sum, kind) => sum + side.counts[kind], 0);

/** The count line. Every kind is listed, zeros too: "nothing dropped" reads as N facts checked, never as nothing looked at. */
const checkedLine = (outcome: Outcome, text: CompareText): string => {
  const perKind = ATOM_KINDS.map((kind) => `${text.kinds[kind]} ${String(outcome.before.counts[kind])}→${String(outcome.after.counts[kind])}`);
  return text.checked(totalOf(outcome.before), totalOf(outcome.after), perKind.join(text.separator));
};

const failing = (changes: readonly Change[]): number => changes.filter((change) => !change.allowed).length;

const verdict = (outcome: Outcome, text: CompareText): string => (outcome.ok ? text.clean : text.failed(failing(outcome.dropped), failing(outcome.added)));

const kindColumn = (kind: AtomKind, text: CompareText): string => `${text.kind[kind]}: `;

const changeLine = (change: Change, path: string, flag: string, text: CompareText): string =>
  `  ${kindColumn(change.kind, text)}${shown(change.text)}  (${path}:${String(change.line)})${change.allowed ? text.allowed(flag) : ""}`;

const reformedLine = (pair: Reformed, text: CompareText): string =>
  `  ${kindColumn(pair.before.kind, text)}${shown(pair.before.text)} → ${shown(pair.after.text)}  (${text.lines(pair.before.line, pair.after.line)})`;

const block = (heading: string, lines: readonly string[]): string[] => (lines.length === 0 ? [] : ["", heading, ...lines]);

const unreadBlock = (outcome: Outcome, text: CompareText): string[] => {
  const sides = [outcome.before, outcome.after];
  const lines = sides.flatMap((side) => side.unread.map((unread) => `  ${side.path}: ${text.unread(unread.kind, unread.reason)}`));
  return block(text.unreadHeading, lines);
};

/** For a person: what was dropped and added, with the line in each file, then what only changed its form. */
export const renderFriendly = (outcome: Outcome, text: CompareText): string => {
  const { before, after } = outcome;
  return [
    `${before.path} → ${after.path}`,
    ...block(
      text.droppedHeading(outcome.dropped.length, before.path, after.path),
      outcome.dropped.map((change) => changeLine(change, before.path, "--allow-dropped", text)),
    ),
    ...block(
      text.addedHeading(outcome.added.length, after.path),
      outcome.added.map((change) => changeLine(change, after.path, "--allow-added", text)),
    ),
    ...block(
      text.reformedHeading(outcome.reformed.length),
      outcome.reformed.map((pair) => reformedLine(pair, text)),
    ),
    ...unreadBlock(outcome, text),
    "",
    checkedLine(outcome, text),
    verdict(outcome, text),
  ].join("\n");
};

const compactChange = (change: Change, path: string, word: string): string =>
  `${path}:${String(change.line)}: ${word} ${change.kind} ${shown(change.text)}${change.allowed ? " (allowed)" : ""}`;

/** For an engineer and grep: one line per fact, the words dropped / added / reformed and the kind in English. */
export const renderCompact = (outcome: Outcome, text: CompareText): string => {
  const { before, after } = outcome;
  return [
    ...outcome.dropped.map((change) => compactChange(change, before.path, "dropped")),
    ...outcome.added.map((change) => compactChange(change, after.path, "added")),
    ...outcome.reformed.map(
      (pair) =>
        `${before.path}:${String(pair.before.line)} → ${after.path}:${String(pair.after.line)}: reformed ${pair.before.kind} ${shown(pair.before.text)} → ${shown(pair.after.text)}`,
    ),
    ...before.unread.map((unread) => `${before.path}: unread ${unread.kind} (${unread.reason})`),
    ...after.unread.map((unread) => `${after.path}: unread ${unread.kind} (${unread.reason})`),
    checkedLine(outcome, text),
    text.tally(failing(outcome.dropped), failing(outcome.added), outcome.reformed.length),
  ].join("\n");
};

const atomJson = (atom: Atom): Readonly<Record<string, string | number>> => ({ kind: atom.kind, key: atom.key, text: atom.text, line: atom.line });

/** For an AI to act on: every dropped and added fact with its line, the reformed pairs, and the counts per kind. */
export const renderJson = (outcome: Outcome): string =>
  JSON.stringify(
    {
      ok: outcome.ok,
      before: outcome.before,
      after: outcome.after,
      dropped: outcome.dropped.map((change) => ({ ...atomJson(change), allowed: change.allowed })),
      added: outcome.added.map((change) => ({ ...atomJson(change), allowed: change.allowed })),
      reformed: outcome.reformed.map((pair) => ({ kind: pair.before.kind, key: pair.before.key, before: atomJson(pair.before), after: atomJson(pair.after) })),
    },
    null,
    2,
  );
