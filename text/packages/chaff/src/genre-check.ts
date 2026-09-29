import { frontMatterValues } from "./genre.ts";

/** Where a genre was set: the command line, chaff.yaml's genre, or one of its by_path entries. */
export type GenreSetting = "--genre" | "config" | "by_path";

type UnknownGenre = {
  readonly where: GenreSetting;
  readonly genre: string;
  /** The by_path entry's files, so the message can say which entry; empty elsewhere. */
  readonly files: readonly string[];
};

type PathGenre = { readonly files: readonly string[]; readonly genre: string | undefined };

type WrittenGenres = { readonly flag: string | undefined; readonly config: string | undefined; readonly byPath: readonly PathGenre[] };

const setting = (where: GenreSetting, genre: string | undefined, files: readonly string[] = []): UnknownGenre[] =>
  genre === undefined ? [] : [{ where, genre, files }];

/**
 * Every genre a setting names that chaff does not know: no rule's use_for matches one, so nothing would run and nothing be listed as not run.
 * All of them, not only the one a file would use, because a wrong setting is wrong for every file.
 */
export const unknownGenres = (written: WrittenGenres, known: readonly string[]): UnknownGenre[] =>
  [
    ...setting("--genre", written.flag),
    ...setting("config", written.config),
    ...written.byPath.flatMap((entry) => setting("by_path", entry.genre, entry.files)),
  ].filter((entry) => !known.includes(entry.genre));

/**
 * The front matter's genre that was not read. Front matter is the document's and often another tool's, so this warns and does not stop:
 * the file falls back to the path, the content or the default. type is not looked at (Zenn's tech / idea mean something else).
 */
export const unknownFrontMatterGenre = (source: string, known: readonly string[]): string | undefined =>
  frontMatterValues(source, "genre").find((value) => value !== "" && !known.includes(value));
