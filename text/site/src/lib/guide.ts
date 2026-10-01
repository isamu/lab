import { getCollection, type CollectionEntry } from "astro:content";
import type { Lang } from "./i18n";

// The order a reader takes the guide in. A page not listed here follows, by name.
const ORDER = [
  "getting-started",
  "documents",
  "documents-statute",
  "documents-report",
  "ai-sounding",
  "configuration",
  "reference",
  "house-style",
  "adding-rules",
  "commands",
  "structure",
  "languages",
  "ci",
  "bibliography",
];

export type GuidePage = { readonly lang: Lang; readonly slug: string; readonly entry: CollectionEntry<"guide"> };

const rank = (slug: string): number => {
  const index = ORDER.indexOf(slug);
  return index === -1 ? ORDER.length : index;
};

/** The guide's pages in one language, in reading order. An entry's id is "<lang>/<page>". */
export const guidePages = async (lang: Lang): Promise<GuidePage[]> =>
  (await getCollection("guide"))
    .flatMap((entry) => {
      const [entryLang, slug] = entry.id.split("/");
      return entryLang === lang && slug ? [{ lang, slug, entry }] : [];
    })
    .sort((a, b) => rank(a.slug) - rank(b.slug) || a.slug.localeCompare(b.slug));

/** A page's title: its first `# ` heading. */
export const titleOf = (entry: CollectionEntry<"guide">): string =>
  (entry.body ?? "")
    .split("\n")
    .find((line) => line.startsWith("# "))
    ?.slice(2)
    .trim() ?? entry.id;
