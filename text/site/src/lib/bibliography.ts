// The bibliography's entries, read once per language, as links a rule page shows under its sources.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { entriesOf, type BibliographyEntry } from "./bibliographyEntries";
import { href, type Lang } from "./i18n";

// astro build runs in text/site.
const pageOf = (lang: Lang): string => readFileSync(resolve(process.cwd(), "src", "content", "guide", lang, "bibliography.md"), "utf8");

const byLanguage: Record<Lang, readonly BibliographyEntry[]> = { ja: entriesOf(pageOf("ja")), en: entriesOf(pageOf("en")) };

/** A rule's sources as links into the bibliography. An id the page does not have is chaff's bug, so it throws. */
export const sourceLinks = (ids: readonly string[], lang: Lang): { readonly label: string; readonly url: string }[] =>
  ids.map((id) => {
    const entry = byLanguage[lang].find((candidate) => candidate.id === id);
    if (entry === undefined) throw new Error(`bibliography (${lang}) has no entry ${id}`);
    return { label: entry.label, url: `${href(`${lang}/guide/bibliography`)}#${id}` };
  });
