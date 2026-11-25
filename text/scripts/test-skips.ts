// Which test files a pull-request run leaves out on one platform (scripts/test-skips.json), so the slow Windows parts stay
// inside their time limit. The daily full run (chaff-windows-daily.yml) leaves nothing out.
import { partFiles, type TestTimes } from "./test-parts.ts";

/** "pr" leaves out the files listed for the platform; "full" runs every file. */
export type TestRun = "pr" | "full";

/** Per platform (process.platform), each left-out file's path from text/ and the reason it can wait for the full run. */
export type SkipTable = Readonly<Record<string, Readonly<Record<string, string>>>>;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const isReasons = (value: unknown): value is Record<string, string> =>
  isRecord(value) && Object.values(value).every((reason) => typeof reason === "string" && reason.trim() !== "");

/** The table read from JSON; a malformed table stops the run, since leaving files out by mistake would go unseen. */
export const parseSkipTable = (json: string): SkipTable => {
  const parsed: unknown = JSON.parse(json);
  if (!isRecord(parsed)) throw new Error("test skips: the table maps a platform to its left-out files");
  Object.entries(parsed).forEach(([platform, reasons]) => {
    if (!isReasons(reasons)) throw new Error(`test skips: ${platform} must map each file to a non-empty reason`);
  });
  return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, Record<string, string>] => isReasons(entry[1])));
};

/** The files this run leaves out: the platform's list on a pull-request run, none on a full run. */
export const skippedFiles = (table: SkipTable, platform: string, run: TestRun): string[] => (run === "pr" ? Object.keys(table[platform] ?? {}) : []);

/** Part `part` of `parts` over the files not left out. */
export const runFiles = (files: readonly string[], part: number, parts: number, times: TestTimes, skipped: readonly string[]): string[] =>
  partFiles(
    files.filter((file) => !skipped.includes(file)),
    part,
    parts,
    times,
  );

const RUN_FLAG = "--run";

/** The run named by `--run pr|full` and the arguments left for node; with no --run, the run is full. */
export const parseRun = (args: readonly string[]): { run: TestRun; rest: string[] } => {
  const at = args.indexOf(RUN_FLAG);
  if (at === -1) return { run: "full", rest: [...args] };
  const value = args[at + 1];
  if (value !== "pr" && value !== "full") throw new Error(`test skips: --run takes pr or full (got ${value ?? "nothing"})`);
  return { run: value, rest: args.filter((_, index) => index !== at && index !== at + 1) };
};
