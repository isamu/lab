// Capitals a document writes only as the name of a kind of file (the MAP files, each MAP file, MAPファイル): the file type,
// named by its extension, not an acronym the reader needs spelled out. Pure; the file nouns come from the file-noun lexicon.
import { escapeRegExp } from "../orthography.ts";

/** One place an acronym stands: the text right before and after it, and the part of speech of the word after it when the language reads one. */
export type AcronymUse = { readonly word: string; readonly preceding: string; readonly following: string; readonly nextPos?: string | undefined };

/** The extension itself (“.MAP”): a dot that does not end a word or a number (U.S.MAP, 1.MAP). */
const EXTENSION_DOT = /(?:^|[^\p{L}\p{N}_.])\.$/u;

/** A file noun ends where no Latin letter or digit follows: MAPファイルを reads ファイル, the MAP filesystem does not read file. */
const fileNounAhead = (fileNouns: readonly string[]): RegExp =>
  new RegExp(String.raw`^[ \t]?(?:${fileNouns.map(escapeRegExp).join("|")})(?![\p{Script=Latin}\p{N}_])`, "iu");

/**
 * The acronyms every use of which is followed by a file noun, or is the extension itself (“.MAP”). One use elsewhere (the WAL
 * receiver beside a WAL file) shows the capitals name more than the file. At least one file noun must not be read as a verb
 * (the SEC files a suit): the tagger misreads a few nouns (the MAP files themselves), so one noun reading is enough.
 */
export const fileTypeNames = (uses: readonly AcronymUse[], fileNouns: readonly string[]): Set<string> => {
  if (fileNouns.length === 0) return new Set();
  const ahead = fileNounAhead(fileNouns);
  const isExtension = (use: AcronymUse): boolean => EXTENSION_DOT.test(use.preceding);
  const isFileUse = (use: AcronymUse): boolean => isExtension(use) || ahead.test(use.following);
  const isNounUse = (use: AcronymUse): boolean => isExtension(use) || use.nextPos !== "VERB";
  const words = new Set(uses.map((use) => use.word));
  return new Set(
    [...words].filter((word) => {
      const own = uses.filter((use) => use.word === word);
      return own.every(isFileUse) && own.some(isNounUse);
    }),
  );
};
