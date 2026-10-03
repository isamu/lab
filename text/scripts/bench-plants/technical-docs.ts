// Seeded mistakes of a README for `yarn bench`: a code fence left without its language, a shell command given a prompt
// the others lack, a heading naming a command its section never shows, and a statement among numbered instructions.
// Pure and deterministic, like scripts/bench-mutations.ts.
import { isJapanese, isProse, linesOf, replaceLine, rewriteFirst, type Mutation, type Plant } from "../bench-text.ts";

const SHELL_FENCE = "```sh";

/** The last line that passes the test, rewritten: the last code fence of a sample is the one a reader reaches last. */
const rewriteLast = (source: string, test: (line: string) => boolean, rewrite: (line: string) => string): Plant | undefined => {
  const lines = linesOf(source);
  const index = lines.findLastIndex(test);
  const line = lines[index];
  return line === undefined ? undefined : { source: replaceLine(lines, index, rewrite(line)), line: index + 1 };
};

/** The last shell fence loses its language; the sample's other fences keep theirs. */
const untagFence = (source: string): Plant | undefined =>
  rewriteLast(
    source,
    (line) => line === SHELL_FENCE,
    () => "```",
  );

/** The last command of a shell block gets a "$ " prompt; the sample's other commands have none. */
const promptCommand = (source: string): Plant | undefined => {
  const lines = linesOf(source);
  const fence = lines.findLastIndex((line) => line === SHELL_FENCE);
  const command = fence === -1 ? undefined : lines[fence + 1];
  return command === undefined || command.startsWith("$") ? undefined : { source: replaceLine(lines, fence + 1, `$ ${command}`), line: fence + 1 };
};

const COMMAND: Readonly<Record<string, string>> = { ja: "`yoyaku start` の", en: "with `roomly start`" };

/** The second-level heading over the sample's commands names a command none of them uses. */
const nameCommand =
  (language: string) =>
  (source: string): Plant | undefined =>
    rewriteFirst(
      source,
      (line) => line === (language === "ja" ? "## 使いかた" : "## Getting started"),
      (line) => (language === "ja" ? `## ${COMMAND.ja ?? ""}使いかた` : `${line} ${COMMAND.en ?? ""}`),
    );

const STEPS = ["1. The tool asks for the address of the booking server.", "2. Run the setup command with that address.", "3. Restart the terminal."].join("\n");

/** A numbered procedure whose first step is a statement, in place of the first English paragraph that is not a heading. */
const statementStep = (source: string): Plant | undefined =>
  rewriteFirst(
    source,
    (line) => isProse(line) && !isJapanese(line) && line.startsWith("Pass "),
    () => STEPS,
  );

export const MUTATIONS: readonly Mutation[] = [
  ...["ja", "en"].map((language): Mutation => ({
    id: `fence-untagged-${language}`,
    rule: "code-fence-language-mix",
    languages: [language],
    plant: untagFence,
  })),
  ...["ja", "en"].map((language): Mutation => ({
    id: `shell-prompt-added-${language}`,
    rule: "shell-prompt-mix",
    languages: [language],
    plant: promptCommand,
  })),
  ...["ja", "en"].map((language): Mutation => ({
    id: `heading-command-renamed-${language}`,
    rule: "heading-command-missing",
    languages: [language],
    plant: nameCommand(language),
  })),
  { id: "step-statement-en", rule: "step-statement-mix", languages: ["en"], plant: statementStep },
];
