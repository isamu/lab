import type { Lexicon, Section } from "../plugin.ts";
import { containsWord, headingWords } from "./heading-words.ts";

/** A heading still open at a point of the outline: its depth, and whether it is a question-and-answer heading. */
type Open = { readonly depth: number; readonly faq: boolean };

const isFaqHeading = (heading: string, faqHeadings: Lexicon): boolean =>
  faqHeadings.some((entry) => containsWord(headingWords(heading), entry.pattern.toLowerCase()));

/**
 * Whether each section stands under a question-and-answer heading (FAQ, よくある質問), at any depth below it. An FAQ's
 * headings are its readers' questions, so the form they take is not the writer's.
 */
export const underFaq = (headed: readonly Section[], faqHeadings: Lexicon): boolean[] =>
  headed
    .reduce<{ readonly open: readonly Open[]; readonly under: readonly boolean[] }>(
      (outline, section) => {
        const ancestors = outline.open.filter((open) => open.depth < section.depth);
        const faq = isFaqHeading(section.heading, faqHeadings);
        return { open: [...ancestors, { depth: section.depth, faq }], under: [...outline.under, ancestors.some((open) => open.faq)] };
      },
      { open: [], under: [] },
    )
    .under.slice();
