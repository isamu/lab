import type { GenreData } from "../genre-parse.ts";
import type { GuideEdit, GuideLayer } from "./layer.ts";

/** Where the bundled guides come from, as a resolved guide names it. */
export const BUNDLED_GUIDES = "genres.yaml";

/** A genre's guide in one language, and every place that wrote it, weakest first. */
export type ResolvedGuide = { readonly genre: string; readonly lines: readonly string[]; readonly from: readonly string[] };

type Current = { readonly lines: readonly string[]; readonly from: readonly string[] };

const applied = (current: Current, edit: GuideEdit | undefined, language: string, from: string): Current => {
  if (edit === undefined) return current;
  if (edit.kind === "off") return { lines: [], from: [...current.from, from] };
  const replaced = edit.replace?.[language];
  const added = edit.add?.[language] ?? [];
  if (replaced === undefined && added.length === 0) return current;
  return { lines: [...(replaced ?? current.lines), ...added], from: [...current.from, from] };
};

/**
 * A genre's guide in a language: genres.yaml's for the genre, else its group's, then each layer in order (weakest first):
 * its guide: off, then its group's entry, then its genre's. undefined for a genre chaff does not know, or when no lines are left.
 */
export const resolveGuide = (data: GenreData, genre: string, language: string, layers: readonly GuideLayer[]): ResolvedGuide | undefined => {
  const own = data.genres.find((entry) => entry.id === genre);
  if (own === undefined) return undefined;
  const group = data.groups.find((entry) => genre.startsWith(`${entry.id}/`));
  const bundled = own.guide ?? group?.guide;
  const start: Current = { lines: bundled?.[language] ?? [], from: bundled === undefined ? [] : [BUNDLED_GUIDES] };
  const end = layers.reduce((current, layer) => {
    const cleared = applied(current, layer.allOff ? { kind: "off" } : undefined, language, layer.from);
    return applied(applied(cleared, group === undefined ? undefined : layer.edits[group.id], language, layer.from), layer.edits[genre], language, layer.from);
  }, start);
  return end.lines.length === 0 ? undefined : { genre, lines: end.lines, from: end.from };
};
