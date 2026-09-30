// The weekly corpus check's verdict on each document, and the issue that reports it. Pure; corpus-health.ts fetches,
// runs `yarn corpus` and writes the files.

/** What refetching one URL document gave. A committed document's fresh text is compared with the committed copy. */
export type FetchOutcome =
  | { readonly id: string; readonly kind: "fetched" }
  | { readonly id: string; readonly kind: "failed"; readonly error: string }
  | { readonly id: string; readonly kind: "differs"; readonly line: number };

export type DocumentHealth =
  | { readonly id: string; readonly status: "ok" }
  | { readonly id: string; readonly status: "fetch-failed"; readonly error: string }
  | { readonly id: string; readonly status: "source-changed"; readonly line: number }
  | { readonly id: string; readonly status: "drift" };

const CHANGES_HEADER = "Changed from corpus/expected.txt";

/** The ids on the "- expected" / "+ actual" lines `yarn corpus` prints after its "Changed from" header. */
export const driftedIds = (corpusReport: string): Set<string> => {
  const lines = corpusReport.split("\n");
  const start = lines.findIndex((line) => line.startsWith(CHANGES_HEADER));
  if (start < 0) return new Set();
  const changes = lines.slice(start + 1).filter((line) => line.startsWith("- ") || line.startsWith("+ "));
  return new Set(changes.map((line) => line.slice(2).split("  ")[0] ?? "").filter((id) => id !== ""));
};

/** The first line (1-based) where the two texts differ, or undefined when they are the same. */
export const firstDifferingLine = (committed: string, fetched: string): number | undefined => {
  if (committed === fetched) return undefined;
  const left = committed.split("\n");
  const right = fetched.split("\n");
  const index = left.findIndex((line, i) => line !== right[i]);
  return (index < 0 ? left.length : index) + 1;
};

/**
 * One verdict per document. A failed fetch comes first (nothing else about the source is known), then a committed
 * copy that no longer matches its source, then results that moved from expected.txt. Drifted ids that were not
 * refetched (statutes, or lines of documents dropped from the manifest) are reported as drift too.
 */
export const classifyDocuments = (outcomes: readonly FetchOutcome[], drifted: ReadonlySet<string>): DocumentHealth[] => {
  const refetched = outcomes.map((outcome): DocumentHealth => {
    if (outcome.kind === "failed") return { id: outcome.id, status: "fetch-failed", error: outcome.error };
    if (outcome.kind === "differs") return { id: outcome.id, status: "source-changed", line: outcome.line };
    return { id: outcome.id, status: drifted.has(outcome.id) ? "drift" : "ok" };
  });
  const seen = new Set(outcomes.map((outcome) => outcome.id));
  const others = [...drifted].filter((id) => !seen.has(id)).map((id): DocumentHealth => ({ id, status: "drift" }));
  return [...refetched, ...others];
};

export const needsAttention = (health: readonly DocumentHealth[]): boolean => health.some((doc) => doc.status !== "ok");

const changesBlock = (corpusReport: string): string[] => {
  const lines = corpusReport.split("\n");
  const start = lines.findIndex((line) => line.startsWith(CHANGES_HEADER));
  return start < 0 ? [] : lines.slice(start).filter((line) => line !== "");
};

const section = (title: string, items: readonly string[], advice: string): string[] =>
  items.length === 0 ? [] : [`## ${title}`, "", ...items, "", advice, ""];

/** The issue body: fetch failures, sources that changed upstream, and results that drifted, each only when present. */
export const issueBody = (health: readonly DocumentHealth[], corpusReport: string, runUrl: string): string => {
  const failed = health.flatMap((doc) => (doc.status === "fetch-failed" ? [`- \`${doc.id}\`: ${doc.error}`] : []));
  const changed = health.flatMap((doc) => (doc.status === "source-changed" ? [`- \`${doc.id}\`: differs from line ${String(doc.line)}`] : []));
  const drift = changesBlock(corpusReport);
  const body = [
    "The weekly corpus check found documents that need a look.",
    "",
    `Run: ${runUrl}`,
    "",
    ...section(
      "Fetch failed",
      failed,
      "The pinned URL did not answer after retries. Check whether the source moved or is gone, and repin it (a Wayback `id_` URL keeps a snapshot) or drop the document.",
    ),
    ...section(
      "Source changed upstream",
      changed,
      "A committed document no longer matches what its URL serves. Nothing was committed: run `yarn corpus:fetch <id>` locally, read the diff, and commit it with `yarn corpus --update` if the change is wanted, or pin the old version.",
    ),
    ...section(
      "Results drifted",
      drift.length === 0 ? [] : ["```", ...drift, "```"],
      "Fetch the documents locally (`yarn corpus:fetch <id>`), read each change, and accept the intended ones with `yarn corpus --update` in a PR.",
    ),
  ];
  return `${body.join("\n").trimEnd()}\n`;
};
