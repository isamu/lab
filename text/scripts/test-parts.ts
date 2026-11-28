// Which test files one part of a split run takes. CI runs the parts side by side; yarn test with no part runs every file.
// The parts are balanced by each file's measured time (scripts/test-times.json, rewritten by yarn test:times from a CI run).

/**
 * The files that each run chaff over every rule example or every guide screen, spread over all the cores. They stay
 * together in part 1, and part 1 takes other files only when they leave room.
 */
export const HEAVY_FILES: readonly string[] = ["test/test_rule_reference.ts", "test/test_guide_screen_output.ts"];

/**
 * Files that a split run leaves out because CI runs them in a job of their own, on one OS: the rule samples run chaff
 * three times per page, their output does not depend on the OS, and in the three-OS parts they would push a part past its time limit.
 */
export const OWN_JOB_FILES: readonly string[] = ["test/test_rule_samples.ts"];

/**
 * How many milliseconds of other files one millisecond of the longest heavy file counts for: the heavy files hold every
 * core, while the other files run fewer at a time than there are cores. Set above the typical ratio of part 1's wall time
 * to the other parts', because the heavy files' time swings more between runners than the rest; at the typical ratio part 1
 * was the slowest part on the runs where they were slow. Re-measure with yarn test:times and the job times when it drifts.
 */
export const HEAVY_FILE_WIDTH = 4.5;

/** The time a file not yet in the table is taken to need, when the table has no times to take a middle value from. */
export const UNMEASURED_FILE_MS = 1000;

/** Each test file's measured time in milliseconds, keyed by its path from text/ with forward slashes. */
export type TestTimes = Readonly<Record<string, number>>;

const measuredTime = (times: TestTimes, file: string): number | undefined => {
  const ms = times[file];
  return ms !== undefined && Number.isFinite(ms) && ms >= 0 ? ms : undefined;
};

const middle = (values: readonly number[]): number => {
  const sorted = values.toSorted((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)] ?? UNMEASURED_FILE_MS;
};

/** A file's time from the table; a file not in it (a new test) is taken to need the middle of the measured times, so it still runs. */
const timeOf = (times: TestTimes, files: readonly string[]): ((file: string) => number) => {
  const fallback = middle(files.map((file) => measuredTime(times, file)).filter((ms) => ms !== undefined));
  return (file) => measuredTime(times, file) ?? fallback;
};

/** Deals the files, longest first, each into the part with the least time so far (the lowest-numbered part on a tie). */
const deal = (files: readonly string[], loads: number[], members: string[][], time: (file: string) => number): void => {
  const longestFirst = files.toSorted((left, right) => time(right) - time(left) || left.localeCompare(right, "en"));
  longestFirst.forEach((file) => {
    const lightest = loads.indexOf(Math.min(...loads));
    loads[lightest] = (loads[lightest] ?? 0) + time(file);
    members[lightest]?.push(file);
  });
};

/** Every part's files, for a split run: the heavy files in part 1, then the rest dealt by time; each part keeps the files' order. */
export const balancedParts = (files: readonly string[], parts: number, times: TestTimes): string[][] => {
  const split = files.filter((file) => !OWN_JOB_FILES.includes(file));
  const heavy = split.filter((file) => HEAVY_FILES.includes(file));
  const rest = split.filter((file) => !HEAVY_FILES.includes(file));
  const time = timeOf(times, rest);
  const loads = Array.from({ length: parts }, (_, index) => (index === 0 && heavy.length > 0 ? Math.max(...heavy.map(time)) * HEAVY_FILE_WIDTH : 0));
  const members = Array.from({ length: parts }, (_, index) => (index === 0 ? [...heavy] : []));
  deal(rest, loads, members, time);
  const order = new Map(files.map((file, index) => [file, index]));
  return members.map((part) => part.toSorted((left, right) => (order.get(left) ?? 0) - (order.get(right) ?? 0)));
};

/** Part `part` of `parts` (counted from 1), leaving out OWN_JOB_FILES when the run is split; the files keep their order. */
export const partFiles = (files: readonly string[], part: number, parts: number, times: TestTimes = {}): string[] => {
  if (!Number.isInteger(parts) || parts < 1 || !Number.isInteger(part) || part < 1 || part > parts)
    throw new Error(`test parts: no part ${part} of ${parts} (a part is 1 to the number of parts)`);
  if (parts === 1) return [...files];
  return balancedParts(files, parts, times)[part - 1] ?? [];
};

/** The part named by `--part <i>/<n>` and the arguments left for node; with no --part, the whole run is one part. */
export const parsePart = (args: readonly string[]): { part: number; parts: number; rest: string[] } => {
  const at = args.indexOf("--part");
  if (at === -1) return { part: 1, parts: 1, rest: [...args] };
  const match = /^(\d+)\/(\d+)$/u.exec(args[at + 1] ?? "");
  if (match === null) throw new Error(`test parts: --part takes <part>/<parts>, like --part 2/5 (got ${args[at + 1] ?? "nothing"})`);
  return { part: Number(match[1]), parts: Number(match[2]), rest: args.filter((_, index) => index !== at && index !== at + 1) };
};
