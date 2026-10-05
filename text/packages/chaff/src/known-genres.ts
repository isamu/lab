import { join } from "node:path";
import { parse } from "yaml";
import { exists, readText } from "./package-files.ts";
import { loadGenres } from "./genre-load.ts";
import { parseGenres, type GenreData } from "./genre-parse.ts";

const idsOf = (data: GenreData): string[] => [...data.groups.map((group) => group.id), ...data.genres.map((genre) => genre.id)];

/** Every genre and genre group genres.yaml names: what a rule's use_for may list. */
export const knownGenres = (): string[] => idsOf(loadGenres());

/**
 * The genres of the genres.yaml beside a rules folder (packages/chaff/rules → packages/chaff/genres.yaml), else chaff's
 * own. The site reads the rules from the source tree after bundling, where chaff's own file is not where the module is.
 */
export const genresBeside = (rulesDir: string): string[] => {
  const file = join(rulesDir, "..", "genres.yaml");
  return exists(file) ? idsOf(parseGenres(parse(readText(file)))) : knownGenres();
};
