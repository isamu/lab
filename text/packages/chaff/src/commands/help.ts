import { commandHelp } from "../command-help.ts";
import type { CliText } from "../cli-text.ts";

/** `chaff <command> --help` prints the command's usage and runs nothing: `init --help` must not write chaff.yaml. */
export const printCommandHelp = (text: CliText, command: string): number => {
  console.log(commandHelp(text.usage, command, text.moreHelp));
  return 0;
};
