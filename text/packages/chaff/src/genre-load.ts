import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { parseGenres, presetLevelsOf, presetProfileOf, type GenreData, type PresetLevels } from "./genre-parse.ts";

const GENRES_FILE = join(dirname(fileURLToPath(import.meta.url)), "..", "genres.yaml");

const loaded: { value: GenreData | undefined } = { value: undefined };

/** The bundled genres.yaml. Read once. */
export const loadGenres = (): GenreData => {
  if (loaded.value !== undefined) return loaded.value;
  try {
    loaded.value = parseGenres(parse(readFileSync(GENRES_FILE, "utf8")));
  } catch (error) {
    throw new Error(`cannot read ${GENRES_FILE}: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }
  return loaded.value;
};

export const presetLevels = (genre: string): PresetLevels => presetLevelsOf(loadGenres(), genre);

export const presetProfile = (genre: string): string | undefined => presetProfileOf(loadGenres(), genre);
