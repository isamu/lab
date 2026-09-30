import { existsSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { CONFIG_FILE } from "../config/load.ts";
import { loadGenres } from "../genre-load.ts";
import { choicePrompt, DEFAULT_GENRE, genreChoices, genreFromAnswer, notAGenre } from "../init-choice.ts";
import type { UiLanguage } from "../ui.ts";

type Terminal = { readonly isTTY?: boolean | undefined };

/** Where init asks: the terminal, or streams a test gives it. */
export type Prompter = { readonly input: NodeJS.ReadableStream & Terminal; readonly output: NodeJS.WritableStream & Terminal };

/** Ask only at a terminal, and only when init will write chaff.yaml: a script or CI gets the default without waiting. */
export const shouldAsk = (stdin: Terminal, stdout: Terminal, configExists: boolean): boolean => stdin.isTTY === true && stdout.isTTY === true && !configExists;

const ask = async (ui: UiLanguage, io: Prompter): Promise<{ readonly genre: string | undefined; readonly answer: string }> => {
  const data = loadGenres();
  io.output.write(`${genreChoices(data, ui).join("\n")}\n`);
  const reader = createInterface({ input: io.input, output: io.output });
  try {
    const answer = await reader.question(choicePrompt(ui));
    const ids = data.genres.map((genre) => genre.id);
    return { genre: genreFromAnswer(answer, ids), answer };
  } finally {
    reader.close();
  }
};

/** The genre init writes: --genre, else the one picked at the prompt, else the default. An answer that is no genre is an error. */
export const initGenre = async (
  flagged: string | undefined,
  ui: UiLanguage,
  dir: string,
  io: Prompter = { input: process.stdin, output: process.stdout },
): Promise<{ readonly genre: string } | { readonly error: string }> => {
  if (flagged !== undefined) return { genre: flagged };
  if (!shouldAsk(io.input, io.output, existsSync(join(dir, CONFIG_FILE)))) return { genre: DEFAULT_GENRE };
  const picked = await ask(ui, io);
  return picked.genre === undefined ? { error: notAGenre(picked.answer.trim(), ui) } : { genre: picked.genre };
};
