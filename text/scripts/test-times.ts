// The lines scripts/test-times-reporter.ts prints for each test file, and the table yarn test:times builds from them.
import type { TestTimes } from "./test-parts.ts";

/** The first field of a time line, so the lines can be found in a CI log among everything else. */
export const TIME_MARK = "chaff-test-file-ms";

/** The node:test events the reporter reads: a test or suite that ended, with the file it is in. */
export type EndedTest = {
  readonly type: string;
  readonly data?: {
    readonly nesting?: number | undefined;
    readonly file?: string | undefined;
    readonly details?: { readonly duration_ms?: number | undefined } | undefined;
  };
};

/** A file's path from `root`, with forward slashes on every OS, as the table and scripts/test.ts write it. */
export const relativeTestPath = (file: string, root: string): string => {
  const forward = file.replaceAll("\\", "/");
  const base = `${root.replaceAll("\\", "/").replace(/\/$/u, "")}/`;
  return forward.startsWith(base) ? forward.slice(base.length) : forward;
};

/** Adds an ended top-level test's time to its file; a file's time is the sum of its top-level tests and suites. */
export const addEndedTest = (totals: Map<string, number>, event: EndedTest, root: string): void => {
  if (event.type !== "test:pass" && event.type !== "test:fail") return;
  const { nesting, file, details } = event.data ?? {};
  const ms = details?.duration_ms;
  if (nesting !== 0 || file === undefined || ms === undefined || !Number.isFinite(ms)) return;
  const path = relativeTestPath(file, root);
  totals.set(path, (totals.get(path) ?? 0) + ms);
};

/** One line per file, in path order: the mark, the whole milliseconds and the path, separated by tabs. */
export const timeLines = (totals: ReadonlyMap<string, number>): string[] =>
  [...totals].toSorted(([left], [right]) => left.localeCompare(right, "en")).map(([file, ms]) => [TIME_MARK, String(Math.round(ms)), file].join("\t"));

const TIME_LINE = new RegExp(`${TIME_MARK}\\t(\\d+)\\t(\\S+)\\s*$`, "u");

/**
 * The times in one or more CI logs (a log line may start with a timestamp); a file timed in several logs or jobs keeps its
 * longest time. Given `job`, only the lines of the jobs whose name starts with it count: gh run view --log starts each line
 * with its job's name.
 */
export const timesFromLogs = (logs: readonly string[], job?: string): Map<string, number> => {
  const times = new Map<string, number>();
  logs.forEach((log) =>
    log.split(/\r?\n/u).forEach((line) => {
      const found = job === undefined || line.startsWith(job) ? TIME_LINE.exec(line) : null;
      if (found?.[1] === undefined || found[2] === undefined) return;
      times.set(found[2], Math.max(times.get(found[2]) ?? 0, Number(found[1])));
    }),
  );
  return times;
};

/** The table as scripts/test-times.json holds it: files in path order, one per line. */
export const timesTable = (times: ReadonlyMap<string, number>): string => {
  const table: Record<string, number> = Object.fromEntries([...times].toSorted(([left], [right]) => left.localeCompare(right, "en")));
  return `${JSON.stringify(table, null, 2)}\n`;
};

/** The table read back from JSON; anything that is not a file path with a time of zero or more is left out. */
export const parseTimesTable = (json: string): TestTimes => {
  const parsed: unknown = JSON.parse(json);
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};
  return Object.fromEntries(
    Object.entries(parsed).filter((entry): entry is [string, number] => typeof entry[1] === "number" && Number.isFinite(entry[1]) && entry[1] >= 0),
  );
};
