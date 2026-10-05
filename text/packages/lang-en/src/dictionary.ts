import { PACKAGE_DIR, joinPath, readText } from "./package-files.ts";

// The English word list (lexicons/dictionary.txt, built by scripts/en-dictionary.ts). It is large, so it is read only
// when a rule asks for it, and once.

const FILE = joinPath(PACKAGE_DIR, "lexicons", "dictionary.txt");

const loaded: { words: ReadonlySet<string> | undefined } = { words: undefined };

const wordsIn = (text: string): ReadonlySet<string> => new Set(text.split("\n").filter((line) => line !== "" && !line.startsWith("#")));

export const dictionary = (): ReadonlySet<string> => {
  if (loaded.words !== undefined) return loaded.words;
  try {
    loaded.words = wordsIn(readText(FILE));
  } catch (error) {
    throw new Error(`${FILE}: cannot read the English word list`, { cause: error });
  }
  return loaded.words;
};
