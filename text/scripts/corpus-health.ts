// The weekly corpus check. Refetches every URL document: one that may not be redistributed goes to corpus/.cache as
// `yarn corpus:fetch` would put it; a committed one goes to a temporary directory and is compared with the committed
// copy, which is never touched. Then runs `yarn corpus` and reports each document as ok, fetch-failed,
// source-changed or drift. Exits 1 when any document needs a look (writing the issue body to --report), 2 on a crash.
//   node scripts/corpus-health.ts [--manifest <path>] [--report <path>] [id ...]
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { docEntries, docPath, storedText, type DocEntry } from "./corpus-docs.ts";
import {
  classifyDocuments,
  corpusRunVerdict,
  driftedIds,
  errorText,
  firstDifferingLine,
  issueBody,
  needsAttention,
  type FetchOutcome,
} from "./corpus-health-report.ts";
import { fetchText, lengthenConnectTimeout } from "./fetch-text.ts";
import { hostOf, isHostGivenUp, paceWait_ms } from "./fetch-pacing.ts";
import { isTransientFetchError, RETRY_DELAYS_MS, withRetry } from "./retry.ts";

const SCRIPTS = dirname(fileURLToPath(import.meta.url));
const CORPUS = join(SCRIPTS, "..", "corpus");
const PAUSE_MS = 1_000;
/** web.archive.org holds most of the URL documents and drops connections from a client that asks too often. */
const HOST_GAP_MS = 5_000;
const GIVE_UP_AFTER_FAILED_DOCS = 2;
const NEEDS_ATTENTION_EXIT = 1;
const CRASH_EXIT = 2;
const REPORT_MAX_BYTES = 64 * 1024 * 1024;

const lastRequestAt_ms = new Map<string, number>();
const failedDocsByHost = new Map<string, number>();

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const pacedFetch = async (url: string): Promise<string> => {
  const host = hostOf(url);
  await sleep(paceWait_ms({ lastRequestAt_ms, gap_ms: HOST_GAP_MS }, host, Date.now()));
  lastRequestAt_ms.set(host, Date.now());
  return fetchText(url);
};

const fetchWithRetry = async (doc: DocEntry): Promise<string> => {
  const host = hostOf(doc.url);
  const failedDocs = failedDocsByHost.get(host) ?? 0;
  if (isHostGivenUp(failedDocs, GIVE_UP_AFTER_FAILED_DOCS)) {
    throw new Error(`${doc.url}: not fetched, ${String(failedDocs)} documents on ${host} already failed after retrying in this run`);
  }
  try {
    return await withRetry(() => pacedFetch(doc.url), {
      delays_ms: RETRY_DELAYS_MS,
      isTransient: isTransientFetchError,
      sleep,
      onRetry: (error, delay_ms) => console.log(`${doc.id}  retrying in ${String(delay_ms)} ms: ${errorText(error)}`),
    });
  } catch (err) {
    if (isTransientFetchError(err)) failedDocsByHost.set(host, failedDocs + 1);
    throw err;
  }
};

/** A committed document's fresh text is written next to the others in scratch, and compared with the committed copy. */
const checkCommitted = (doc: DocEntry, text: string, scratch: string): FetchOutcome => {
  const committed = docPath(CORPUS, doc);
  writeFileSync(join(scratch, basename(committed)), text);
  const line = firstDifferingLine(existsSync(committed) ? readFileSync(committed, "utf8") : "", text);
  return line === undefined ? { id: doc.id, kind: "fetched" } : { id: doc.id, kind: "differs", line };
};

const refetch = async (doc: DocEntry, scratch: string): Promise<FetchOutcome> => {
  try {
    const text = storedText(doc, await fetchWithRetry(doc));
    if (doc.redistribute) return checkCommitted(doc, text, scratch);
    const out = docPath(CORPUS, doc);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, text);
    return { id: doc.id, kind: "fetched" };
  } catch (err) {
    return { id: doc.id, kind: "failed", error: errorText(err) };
  }
};

const outcomeText = (outcome: FetchOutcome): string => (outcome.kind === "failed" ? `fetch failed: ${outcome.error}` : outcome.kind);

/** `yarn corpus`'s report. Exit 1 with a list of changes is drift; anything else but a clean 0 is a crash. */
const corpusReport = (): string => {
  const run = spawnSync(process.execPath, [join(SCRIPTS, "corpus-run.ts")], { encoding: "utf8", maxBuffer: REPORT_MAX_BYTES });
  if (corpusRunVerdict(run.status, run.stdout) === "crashed") throw new Error(`corpus-run.ts exited with ${String(run.status)}: ${run.stderr}`);
  return run.stdout;
};

const main = async (): Promise<void> => {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { manifest: { type: "string", default: join(CORPUS, "manifest.json") }, report: { type: "string" } },
  });
  const manifest: unknown = JSON.parse(readFileSync(values.manifest, "utf8"));
  const docs = docEntries(manifest).filter((doc) => positionals.length === 0 || positionals.includes(doc.id));
  if (!(await lengthenConnectTimeout())) console.log("connect timeout left at undici's default: no undici Agent found behind fetch");
  const scratch = mkdtempSync(join(tmpdir(), "chaff-corpus-health-"));
  const outcomes = await docs.reduce<Promise<FetchOutcome[]>>(async (previous, doc) => {
    const done = await previous;
    const outcome = await refetch(doc, scratch);
    console.log(`${doc.id}  ${outcomeText(outcome)}`);
    await sleep(PAUSE_MS);
    return [...done, outcome];
  }, Promise.resolve([]));
  console.log(`committed documents as fetched now: ${scratch}`);

  const report = corpusReport();
  console.log(report);
  const health = classifyDocuments(outcomes, driftedIds(report));
  health.filter((doc) => doc.status !== "ok").forEach((doc) => console.log(`${doc.status}  ${doc.id}`));
  if (values.report !== undefined) writeFileSync(values.report, issueBody(health, report, process.env["RUN_URL"] ?? "(local run)"));
  if (needsAttention(health)) process.exitCode = NEEDS_ATTENTION_EXIT;
};

// A crash exits 2, not 1, so the workflow does not open an issue from a report that was never written.
try {
  await main();
} catch (err) {
  console.error(err);
  process.exitCode = CRASH_EXIT;
}
