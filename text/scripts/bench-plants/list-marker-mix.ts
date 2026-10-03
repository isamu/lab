// Seeded list bullets for `yarn bench`: the last item of a bulleted list written with another bullet, which Markdown splits off.
// Pure and deterministic, like scripts/bench-mutations.ts.
import { codeLines, linesOf, replaceLine, type Mutation, type Plant } from "../bench-text.ts";

const ITEM = /^- (\S.*)$/u;

/** The index of the last item of the first top-level list of two or more `-` items, outside code. */
const lastItemOfFirstList = (lines: readonly string[]): number | undefined => {
  const code = codeLines(lines);
  const isItem = (at: number): boolean => !code.has(at) && ITEM.test(lines[at] ?? "");
  const start = lines.findIndex((_line, at) => isItem(at) && isItem(at + 1) && !isItem(at - 1));
  if (start === -1) return undefined;
  const end = lines.findIndex((_line, at) => at > start && !isItem(at));
  return (end === -1 ? lines.length : end) - 1;
};

/** Writes the list's last item with `*` instead of `-`. */
const starOnLast = (source: string): Plant | undefined => {
  const lines = linesOf(source);
  const index = lastItemOfFirstList(lines);
  const line = index === undefined ? undefined : lines[index];
  if (index === undefined || line === undefined) return undefined;
  return { source: replaceLine(lines, index, `* ${line.slice(2)}`), line: index + 1 };
};

export const MUTATIONS: readonly Mutation[] = [{ id: "list-star-last", rule: "list-marker-mix", languages: ["ja", "en"], plant: starOnLast }];
