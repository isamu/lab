// A seeded line run into a table, for `yarn bench`: a sentence written right under the first table's last row.
// Pure and deterministic, like scripts/bench-mutations.ts.
import { codeLines, isJapanese, isTableRow, linesOf, type Mutation, type Plant } from "../bench-text.ts";

const NOTE: Readonly<Record<string, string>> = { ja: "金額はすべて税込みです。", en: "All amounts include tax." };

/** Inserts the note right after the last row of the first table outside code. */
const noteUnderTable = (source: string): Plant | undefined => {
  const lines = linesOf(source);
  const code = codeLines(lines);
  const first = lines.findIndex((line, at) => !code.has(at) && isTableRow(line));
  if (first === -1) return undefined;
  const after = lines.findIndex((line, at) => at > first && !isTableRow(line));
  const end = after === -1 ? lines.length : after;
  const note = NOTE[isJapanese(lines[first] ?? "") ? "ja" : "en"] ?? "";
  return { source: [...lines.slice(0, end), note, ...lines.slice(end)].join("\n"), line: end + 1 };
};

export const MUTATIONS: readonly Mutation[] = [{ id: "table-absorbed-line", rule: "table-absorbed-line", languages: ["ja", "en"], plant: noteUnderTable }];
