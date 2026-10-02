// corpus/expected/ holds the expected summary split by rule, so a PR that changes one rule's findings edits one
// rule's file. <rule>.txt lists "<document>  <count>"; _documents.txt lists every document with an expectation, so a
// document with no findings ("clean") is told apart from one never run.

/** The file that lists the documents. A rule id never starts with "_". */
export const DOCUMENTS_FILE = "_documents.txt";

const SEPARATOR = "  ";
const CLEAN = "clean";

type Count = { readonly rule: string; readonly count: string };

const idOf = (line: string): string => line.split(SEPARATOR)[0] ?? "";

/** "rule 2, other-rule 1" as its counts; "clean" as none. */
const countsOf = (line: string): Count[] => {
  const body = line.slice(idOf(line).length + SEPARATOR.length);
  if (body === CLEAN) return [];
  return body.split(", ").map((part) => {
    const space = part.lastIndexOf(" ");
    return { rule: part.slice(0, space), count: part.slice(space + 1) };
  });
};

const append = (files: Map<string, string[]>, name: string, line: string): Map<string, string[]> => files.set(name, [...(files.get(name) ?? []), line]);

/** The summary lines ("id  rule 2, other 1" or "id  clean") as file name → lines, one file per rule plus the document list. */
export const splitSummary = (lines: readonly string[]): Map<string, string[]> =>
  lines.reduce(
    (files, line) =>
      countsOf(line).reduce(
        (acc, { rule, count }) => append(acc, `${rule}.txt`, `${idOf(line)}${SEPARATOR}${count}`),
        append(files, DOCUMENTS_FILE, idOf(line)),
      ),
    new Map<string, string[]>(),
  );

const countsByDocument = (files: ReadonlyMap<string, readonly string[]>): Map<string, Count[]> =>
  [...files.entries()]
    .filter(([name]) => name !== DOCUMENTS_FILE)
    .reduce((acc, [name, lines]) => {
      const rule = name.replace(/\.txt$/u, "");
      lines.forEach((line) => {
        const id = idOf(line);
        acc.set(id, [...(acc.get(id) ?? []), { rule, count: line.slice(id.length + SEPARATOR.length) }]);
      });
      return acc;
    }, new Map<string, Count[]>());

/**
 * The summary lines back from the split files, in the document list's order, rules in the order summaryLine writes
 * them. Throws when a rule's file names a document the list does not have: that count would be dropped silently.
 */
export const joinSummary = (files: ReadonlyMap<string, readonly string[]>): string[] => {
  const documents = files.get(DOCUMENTS_FILE) ?? [];
  const counts = countsByDocument(files);
  const unlisted = [...counts.keys()].filter((id) => !documents.includes(id));
  if (unlisted.length > 0) throw new Error(`corpus/expected: ${unlisted.join(", ")} not in ${DOCUMENTS_FILE}`);
  return documents.map((id) => {
    const parts = (counts.get(id) ?? []).toSorted((left, right) => left.rule.localeCompare(right.rule)).map(({ rule, count }) => `${rule} ${count}`);
    return `${id}${SEPARATOR}${parts.length === 0 ? CLEAN : parts.join(", ")}`;
  });
};
