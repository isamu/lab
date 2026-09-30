import type { GenreData, GenreDefinition } from "./genre-parse.ts";
import { openingLine } from "./opening-line.ts";
import { detected, type ProfileDefinition } from "./profile/parse.ts";

/** The file a genre is suggested for: where it is, what it says, and its language. */
export type SuggestInput = { readonly path: string; readonly source: string; readonly language: string };

/** A path cue names the kind outright, so it outweighs any count of lines. */
const BY_PATH = Number.POSITIVE_INFINITY;

/** How the body opens (Dear ..., 拝啓) says what the document is even when it encloses another kind; a path still says more. */
const BY_OPENING = Number.MAX_VALUE;

const opensAs = (genre: GenreDefinition, input: SuggestInput): boolean => {
  const opening = genre.suggest.openings[input.language];
  const first = openingLine(input.source);
  return opening !== undefined && first !== undefined && opening.test(first);
};

/** How many times over the genre's lines reach their minimum: 1 is just enough, 0 is none of that shape. */
const linesScore = (genre: GenreDefinition, input: SuggestInput): number => {
  const cue = genre.suggest.lines[input.language];
  if (cue === undefined) return 0;
  return input.source.split("\n").filter((line) => cue.line.test(line)).length / cue.minLines;
};

/** A genre that reads with a profile has the profile's shape (a statute's article lines) as just-enough evidence. */
const profileScore = (genre: GenreDefinition, input: SuggestInput, profiles: readonly ProfileDefinition[]): number => {
  const profile = profiles.find((definition) => definition.id === genre.profile);
  return profile !== undefined && detected(profile, input.source, input.language) ? 1 : 0;
};

const scoreOf = (genre: GenreDefinition, input: SuggestInput, profiles: readonly ProfileDefinition[]): number => {
  if (genre.suggest.paths.some((pattern) => pattern.test(input.path))) return BY_PATH;
  if (opensAs(genre, input)) return BY_OPENING;
  return Math.max(linesScore(genre, input), profileScore(genre, input, profiles));
};

type Scored = { readonly genre: GenreDefinition; readonly score: number };

/**
 * The genre a file with no genre set looks like, for the screen to suggest. Never used to check the file: switching silently
 * would change what an existing run reports. The genre whose cues the file meets most strongly wins (a transcript that
 * discusses a bill has more speaker lines than lines about "this Act"); a tie goes to the genre listed first in genres.yaml.
 */
export const suggestGenre = (input: SuggestInput, data: GenreData, profiles: readonly ProfileDefinition[]): GenreDefinition | undefined =>
  data.genres
    .map((genre): Scored => ({ genre, score: scoreOf(genre, input, profiles) }))
    .filter((entry) => entry.score >= 1)
    .reduce<Scored | undefined>((best, entry) => (best === undefined || entry.score > best.score ? entry : best), undefined)?.genre;
