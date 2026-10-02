import type { Detector, Finding, MarkupHeading, ProseDocument } from "../plugin.ts";
import { findingAt, writtenHeadings } from "./markup-finding.ts";

/** A character drawn as an emoji: one that is by default, a pictograph asking for it (U+FE0F), or a keycap (1️⃣). ™, → and anything asking for text (U+FE0E) are text. */
const EMOJI = new RegExp(String.raw`\p{Emoji_Presentation}(?!\u{FE0E})|\p{Extended_Pictographic}\u{FE0F}|[0-9#*]\u{FE0F}?\u{20E3}`, "u");

export const hasEmoji = (text: string): boolean => EMOJI.test(text);

/** The headings, in document order, whose words carry an emoji. */
export const emojiHeadings = (doc: ProseDocument): MarkupHeading[] => writtenHeadings(doc).filter((heading) => hasEmoji(heading.text));

/** A count, not a density: one decorated heading is a choice, a row of them is a template. */
export const emojiHeading: Detector = (doc, options): Finding[] => {
  const marked = emojiHeadings(doc);
  if (marked.length === 0 || marked.length < options.limit) return [];
  return marked.map((heading) => findingAt(doc, heading, { heading: heading.text, count: marked.length, limit: options.limit }));
};
