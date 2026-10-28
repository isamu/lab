import { entryIn } from "./lexicon-match.ts";
import { warningTextStart } from "../warning-action.ts";
import type { LexiconEntry, Paragraph, Sentence } from "../plugin.ts";

// Sentences whose forms say nothing about the writer's choice of register. Pure: reads paragraphs, sentences and the source;
// the words come from the language's notice-phrase, contraction-term and warning-label lexicons.

/**
 * The sentences of a paragraph of disclaimer wording (…does not constitute or imply its endorsement…). A publisher appends
 * it to every page in its own fixed wording, so its forms are not the writer's: they are neither counted nor pointed at.
 */
export const noticeSentences = (paragraphs: readonly Paragraph[], cues: readonly LexiconEntry[]): Set<Sentence> =>
  new Set(paragraphs.flatMap((paragraph) => (paragraph.sentences.some((sentence) => cues.some((cue) => entryIn(sentence, cue))) ? paragraph.sentences : [])));

/** A sentence about contractions (Avoid negative contractions like can't and don't.) names its forms; it does not use them. */
export const talksAboutContractions = (sentence: Sentence, terms: readonly LexiconEntry[]): boolean => terms.some((term) => entryIn(sentence, term));

/** A Hugo shortcode ({{< warning >}}, {{< alert title="Warning" >}}) or a Docusaurus admonition (:::caution) opening a paragraph. */
const SHORTCODE_OPENERS = ["{{<", "{{%"];
const SHORTCODE_TITLE = /\btitle\s*=\s*["']([^"']+)["']/u;
const ADMONITION = /^:::\s*([\w-]+)/u;

/** The name and the attributes of the shortcode opening the text, or undefined when none does. */
const shortcodeAt = (text: string): { readonly name: string; readonly attributes: string } | undefined => {
  const end = text.indexOf("}}");
  if (!SHORTCODE_OPENERS.some((opener) => text.startsWith(opener)) || end < 0) return undefined;
  const [name = "", ...attributes] = text
    .slice(3, end - 1)
    .trim()
    .split(" ");
  return { name, attributes: attributes.join(" ") };
};

const isLabel = (word: string | undefined, labels: readonly string[]): boolean =>
  word !== undefined && labels.some((label) => label.toLowerCase() === word.trim().toLowerCase());

/** Whether a paragraph's text opens as a warning: a label (Warning:, > [!WARNING]), a shortcode or an admonition naming one. */
const opensWarning = (text: string, labels: readonly string[]): boolean => {
  if (warningTextStart(text, labels) !== undefined) return true;
  const shortcode = shortcodeAt(text);
  if (shortcode !== undefined) return isLabel(shortcode.name, labels) || isLabel(SHORTCODE_TITLE.exec(shortcode.attributes)?.[1], labels);
  return isLabel(ADMONITION.exec(text)?.[1], labels);
};

/**
 * The sentences of a warning (Do not run this on an internet-facing cluster.). A warning spells the negative out for
 * stress, as a writer bolds a word: counted, never pointed at.
 */
export const warningSentences = (paragraphs: readonly Paragraph[], source: string, labels: readonly string[]): Set<Sentence> =>
  new Set(
    paragraphs.flatMap((paragraph) => (opensWarning(source.slice(paragraph.span.start, paragraph.span.end).trimStart(), labels) ? paragraph.sentences : [])),
  );
