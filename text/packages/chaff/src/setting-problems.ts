import type { Config } from "./config/load.ts";
import type { CliText } from "./cli-text.ts";
import { GENRES } from "./genre.ts";
import { unknownGenres, writtenGenres } from "./genre-check.ts";
import { loadProfiles } from "./profile/load.ts";
import { unknownProfiles, writtenProfiles } from "./profile/check.ts";

const genreProblems = (command: string, genreFlag: string | undefined, config: Config, text: CliText): string[] =>
  unknownGenres(writtenGenres(command, genreFlag, config), GENRES).map((entry) =>
    text.unknownGenre(entry.genre, text.genreWhere(entry.where, entry.files), GENRES),
  );

const profileProblems = (command: string, config: Config, text: CliText): string[] => {
  const known = loadProfiles().map((definition) => definition.id);
  return unknownProfiles(writtenProfiles(command, config), known).map((entry) =>
    text.unknownProfile(entry.profile, text.profileWhere(entry.where, entry.files), known),
  );
};

/** Settings that name something chaff does not have. Each would silently check less than was asked, so the run stops on them. */
export const settingProblems = (command: string, genreFlag: string | undefined, config: Config, text: CliText): string[] => [
  ...genreProblems(command, genreFlag, config, text),
  ...profileProblems(command, config, text),
];
