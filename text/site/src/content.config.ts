import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";

// One Markdown file per guide page, per language: src/content/guide/<lang>/<page>.md. STYLE.md beside them is
// the writing convention the pages follow (checked with chaff.yaml), not a page.
const guide = defineCollection({
  loader: glob({ base: "./src/content/guide", pattern: ["*/*.md", "!*/STYLE.md"] }),
});

export const collections = { guide };
