/**
 * Options of the commands that take files to check, whose value is the next argument. That value is not a file.
 * `--why` (relax), `--format` and `--language` (tree) belong to commands that read their own arguments.
 */
export const VALUE_FLAGS: readonly string[] = ["--sarif", "--genre", "--rule", "--line"];

/** The arguments that name what to check: everything that is neither an option nor an option's value. */
export const targetsOf = (args: readonly string[]): string[] =>
  args.filter((arg, index) => !arg.startsWith("--") && !(index > 0 && VALUE_FLAGS.includes(args[index - 1] ?? "")));
