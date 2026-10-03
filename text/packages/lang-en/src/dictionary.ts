import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// The English word list (lexicons/dictionary.txt, built by scripts/en-dictionary.ts). It is large, so it is read only
// when a rule asks for it, and once.

const FILE = join(dirname(fileURLToPath(import.meta.url)), "..", "lexicons", "dictionary.txt");

const loaded: { words: ReadonlySet<string> | undefined } = { words: undefined };

const wordsIn = (text: string): ReadonlySet<string> => new Set(text.split("\n").filter((line) => line !== "" && !line.startsWith("#")));

export const dictionary = (): ReadonlySet<string> => {
  if (loaded.words !== undefined) return loaded.words;
  try {
    loaded.words = wordsIn(readFileSync(FILE, "utf8"));
  } catch (error) {
    throw new Error(`${FILE}: cannot read the English word list`, { cause: error });
  }
  return loaded.words;
};
