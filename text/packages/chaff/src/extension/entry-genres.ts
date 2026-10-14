// A word-list entry's genres as a plugin writes them: a non-empty list of the genres and groups chaff knows (legal,
// blog/tech). Pure: the known ids come in.

const printed = (value: unknown): string => JSON.stringify(value) ?? String(value);

/** What cannot be read in genres, printed: the whole value when it is not a non-empty list, else its unknown items. undefined when it reads. */
export const genresProblemOf = (genres: unknown, known: ReadonlySet<string>): string | undefined => {
  if (!Array.isArray(genres) || genres.length === 0) return printed(genres);
  const unknown = genres.filter((genre: unknown) => typeof genre !== "string" || !known.has(genre));
  return unknown.length === 0 ? undefined : printed(unknown);
};

/** genres when they read, as a list of ids. */
export const readGenres = (genres: unknown, known: ReadonlySet<string>): string[] | undefined =>
  Array.isArray(genres) && genresProblemOf(genres, known) === undefined ? genres.filter((genre: unknown) => typeof genre === "string") : undefined;
