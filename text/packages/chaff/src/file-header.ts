import { CLI_TEXT, type GenreSource } from "./cli-text.ts";
import { loadGenres } from "./genre-load.ts";
import type { GenreDefinition } from "./genre-parse.ts";
import { suggestGenre } from "./genre-suggest.ts";
import { loadProfiles } from "./profile/load.ts";
import { uiLanguageOf } from "./ui.ts";

/** The file's first lines, and the notes after its not-run list: the genre it looks like, when none was set. */
type FileHeader = { readonly header: string; readonly notes: readonly string[] };

type Placed = { readonly genre: string; readonly from: GenreSource };

type Counts = { readonly shelved: number; readonly hushed: number };

/** The genre the file looks like, only when none was set or guessed: suggested on screen, never used for the run. */
const suggestionFor = (path: string, source: string, language: string, from: GenreSource): GenreDefinition | undefined =>
  from === "default" ? suggestGenre({ path, source, language }, loadGenres(), loadProfiles()) : undefined;

/** In the file's language. The note names the genre the file was checked as. */
export const fileHeader = (path: string, source: string, language: string, placed: Placed, counts: Counts): FileHeader => {
  const text = CLI_TEXT[uiLanguageOf(language)];
  const first = text.header(path, placed.genre, text.languageName(language), text.genreSource[placed.from], counts.shelved, counts.hushed);
  const suggestion = suggestionFor(path, source, language, placed.from);
  if (suggestion === undefined) return { header: first, notes: [] };
  const name = suggestion.name[uiLanguageOf(language)] ?? suggestion.id;
  return { header: [first, text.suggested(name, suggestion.id)].join("\n"), notes: [text.suggestedNote(name, suggestion.id, placed.genre)] };
};
