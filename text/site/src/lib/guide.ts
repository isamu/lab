import { getCollection, type CollectionEntry } from "astro:content";
import type { Lang } from "./i18n";

// The order a newcomer reads the guide in: a first run, then their kind of document, then fitting chaff to the team,
// the reference, and last the uses that build on all of it (AI-written text, AI evals, rules of your own).
// A page not listed here follows, by name.
const ORDER = [
  "getting-started",
  "documents",
  "documents-blog",
  "documents-contract",
  "documents-statute",
  "documents-email",
  "documents-minutes",
  "documents-report",
  "documents-manual",
  "documents-press",
  "documents-paper",
  "structure",
  "configuration",
  "house-style",
  "languages",
  "ci",
  "commands",
  "reference",
  "ai-sounding",
  "ai-evals",
  "writing-plugins",
  "adding-rules",
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
