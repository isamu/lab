// Pure: what `chaff <command> --help` prints, taken from the usage that `chaff --help` prints, so the two cannot drift.

const ENTRY = /^ {2}chaff (\S+)/u;
const CONTINUATION = /^ {3,}\S/u;
const HELP_FLAGS: ReadonlySet<string> = new Set(["--help", "-h"]);

/** Whether the arguments after the command ask for its help. */
export const asksForHelp = (argv: readonly string[]): boolean => argv.slice(1).some((arg) => HELP_FLAGS.has(arg));

const namesOf = (line: string): readonly string[] => ENTRY.exec(line)?.[1]?.split("|") ?? [];

/** The usage's lines for one command: each line naming it ("  chaff relax|strict|off …"), with the lines indented under it. */
export const commandUsage = (usage: string, command: string): string[] =>
  usage.split("\n").reduce<{ owned: boolean; lines: string[] }>(
    (state, line) => {
      const owned = ENTRY.test(line) ? namesOf(line).includes(command) : state.owned && CONTINUATION.test(line);
      return { owned, lines: owned ? [...state.lines, line] : state.lines };
    },
    { owned: false, lines: [] },
  ).lines;

/** `chaff <command> --help`: the command's lines of the usage and where the rest is, or the whole usage when it has none. */
export const commandHelp = (usage: string, command: string, moreHelp: string): string => {
  const lines = commandUsage(usage, command);
  return lines.length === 0 ? usage : [...lines, "", moreHelp].join("\n");
};
