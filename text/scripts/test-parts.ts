// Which test files one part of a split run takes. CI runs the parts side by side; yarn test with no part runs every file.

/**
 * The files that each run chaff over every rule example or every guide screen, spread over all the cores. Together they
 * take about as long as a part of the rest, so they are a part of their own.
 */
export const HEAVY_FILES: readonly string[] = ["test/test_rule_reference.ts", "test/test_guide_screen_output.ts"];

/** Part `part` of `parts` (counted from 1): part 1 is the heavy files, and the others share the rest file by file. */
export const partFiles = (files: readonly string[], part: number, parts: number): string[] => {
  if (!Number.isInteger(parts) || parts < 1 || !Number.isInteger(part) || part < 1 || part > parts)
    throw new Error(`test parts: no part ${part} of ${parts} (a part is 1 to the number of parts)`);
  if (parts === 1) return [...files];
  const rest = files.filter((file) => !HEAVY_FILES.includes(file));
  return part === 1 ? files.filter((file) => HEAVY_FILES.includes(file)) : rest.filter((_, index) => index % (parts - 1) === part - 2);
};

/** The part named by `--part <i>/<n>` and the arguments left for node; with no --part, the whole run is one part. */
export const parsePart = (args: readonly string[]): { part: number; parts: number; rest: string[] } => {
  const at = args.indexOf("--part");
  if (at === -1) return { part: 1, parts: 1, rest: [...args] };
  const match = /^(\d+)\/(\d+)$/u.exec(args[at + 1] ?? "");
  if (match === null) throw new Error(`test parts: --part takes <part>/<parts>, like --part 2/5 (got ${args[at + 1] ?? "nothing"})`);
  return { part: Number(match[1]), parts: Number(match[2]), rest: args.filter((_, index) => index !== at && index !== at + 1) };
};
