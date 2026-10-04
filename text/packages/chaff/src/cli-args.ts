/**
 * Options of the commands that take files to check, whose value is the next argument. That value is not a file.
 * `--why` (relax), `--format` and `--language` (tree) belong to commands that read their own arguments.
 */
const VALUE_FLAGS: ReadonlySet<string> = new Set(["--sarif", "--genre", "--rule", "--line", "--include"]);

/** The arguments that name what to check: everything that is neither an option nor an option's value. */
export const targetsOf = (args: readonly string[]): string[] =>
  args.filter((arg, index) => !arg.startsWith("--") && !(index > 0 && VALUE_FLAGS.has(args[index - 1] ?? "")));

/** The settings with --experimental applied: the command line turns experimental rules on as chaff.yaml can. */
export const withExperimental = <T extends { readonly experimental: boolean }>(config: T, args: readonly string[]): T => ({
  ...config,
  experimental: config.experimental || args.includes("--experimental"),
});

/** Whether this run shows the genre's guide: everywhere it would, unless --no-guide leaves it out. */
export const showsGuide = (args: readonly string[]): boolean => !args.includes("--no-guide");

/** The settings with each --include <glob> added to chaff.yaml's include: the command line widens a directory walk as chaff.yaml can. */
export const withIncludes = <T extends { readonly include?: readonly string[] | undefined }>(config: T, args: readonly string[]): T => {
  const given = args.flatMap((arg, index) => (index > 0 && args[index - 1] === "--include" && !arg.startsWith("--") ? [arg] : []));
  return given.length === 0 ? config : { ...config, include: [...(config.include ?? []), ...given] };
};
