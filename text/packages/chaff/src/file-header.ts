import { CLI_TEXT, type GenreSource } from "./cli-text.ts";
import { loadGenres } from "./genre-load.ts";
import type { GenreDefinition } from "./genre-parse.ts";
import { suggestGenre } from "./genre-suggest.ts";
import { loadProfiles } from "./profile/load.ts";
import { uiLanguageOf } from "./ui.ts";

/** The file's first lines, and the notes after its not-run list: the genre it looks like, when none was set. */
type FileHeader = { readonly header: string; readonly notes: readonly string[] };

/** unread: a genre the front matter wrote that chaff does not know (already reported on stderr). */
type Placed = { readonly genre: string; readonly from: GenreSource; readonly unread?: string | undefined };

type Counts = { readonly shelved: number; readonly hushed: number };

/**
 * The genre the file looks like, only when nothing set or guessed one: suggested on screen, never used for the run.
 * A front matter genre chaff could not read is a genre the writer did set, so the note's "no genre was set" would be untrue.
 */
const suggestionFor = (path: string, source: string, language: string, placed: Placed): GenreDefinition | undefined =>
  placed.from === "default" && placed.unread === undefined ? suggestGenre({ path, source, language }, loadGenres(), loadProfiles()) : undefined;

/** In the file's language. The note names the genre the file was checked as. */
export const fileHeader = (path: string, source: string, language: string, placed: Placed, counts: Counts): FileHeader => {
  const text = CLI_TEXT[uiLanguageOf(language)];
  const first = text.header(path, placed.genre, text.languageName(language), text.genreSource[placed.from], counts.shelved, counts.hushed);
  const suggestion = suggestionFor(path, source, language, placed);
  if (suggestion === undefined) return { header: first, notes: [] };
  const name = suggestion.name[uiLanguageOf(language)] ?? suggestion.id;
  return { header: [first, text.suggested(name, suggestion.id)].join("\n"), notes: [text.suggestedNote(name, suggestion.id, placed.genre)] };
};
