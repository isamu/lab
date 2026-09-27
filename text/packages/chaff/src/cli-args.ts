/** Options that take the next argument as their value. That value is not a file to check. */
export const VALUE_FLAGS: readonly string[] = ["--sarif", "--genre", "--why", "--format"];

/** The arguments that name what to check: everything that is neither an option nor an option's value. */
export const targetsOf = (args: readonly string[]): string[] =>
  args.filter((arg, index) => !arg.startsWith("--") && !(index > 0 && VALUE_FLAGS.includes(args[index - 1] ?? "")));
