// A paragraph that announces a restatement (つまり, このように, In other words) and then mostly repeats the paragraph
// before it. Pure; measured in content morphemes by base form, the way heading-echo measures a heading. The announcing
// words come from the language's restating-opener lexicon.
import { newContentMorphemes } from "./content-morphemes.ts";
import type { Detector, Finding, Paragraph, ProseDocument, Token } from "../plugin.ts";

/** A paragraph with fewer content words than this says too little to measure. */
const MIN_CONTENT_WORDS = 4;

const PERCENT = 100;

/** What may follow the opener: a comma, a space or the end; in Japanese also the next word straight away (つまり実行時に). */
const AFTER_OPENER = /^(?:$|[\s、，,:：]|[^\p{Script=Latin}])/u;

/** The opener a paragraph starts with, as written, or undefined. Case is folded; the longest opener wins. */
export const openerOf = (text: string, openers: readonly string[]): string | undefined => {
  const trimmed = text.trimStart();
  const folded = trimmed.toLowerCase();
  const found = openers
    .filter((opener) => folded.startsWith(opener.toLowerCase()) && AFTER_OPENER.test(trimmed.slice(opener.length)))
    .toSorted((left, right) => right.length - left.length)[0];
  return found === undefined ? undefined : trimmed.slice(0, found.length);
};

/** The share of the later tokens' content words, in percent, that the earlier tokens already hold (by base form). */
export const repeatedShare = (earlier: readonly Token[], later: readonly Token[]): { readonly share: number; readonly words: number } => {
  const words = newContentMorphemes([], later);
  if (words === 0) return { share: 0, words };
  return { share: Math.round(((words - newContentMorphemes(earlier, later)) / words) * PERCENT), words };
};

const tokensOf = (paragraph: Paragraph): Token[] => paragraph.sentences.flatMap((sentence) => sentence.tokens ?? []);

/** The paragraph's tokens past its opener: the opener itself is not what the paragraph says. */
const tokensAfterOpener = (paragraph: Paragraph, opener: string): Token[] => {
  const [first, ...rest] = paragraph.sentences;
  if (first === undefined) return [];
  const openerEnd = first.text.length - first.text.trimStart().length + opener.length;
  return [...(first.tokens ?? []).filter((token) => token.span.end > openerEnd), ...rest.flatMap((sentence) => sentence.tokens ?? [])];
};

/** Two paragraphs with only blank lines between: no heading, list, table or code separates them. */
const isNextTo = (doc: ProseDocument, earlier: Paragraph, later: Paragraph): boolean => doc.source.slice(earlier.span.end, later.span.start).trim() === "";

const findingOf = (paragraph: Paragraph, opener: string, share: number, limit: number): Finding => {
  const first = paragraph.sentences[0];
  const lead = first === undefined ? 0 : first.text.length - first.text.trimStart().length;
  return {
    rule: "paragraph-restatement",
    severity: "info",
    line: 0,
    column: 0,
    quote: first?.text.trim() ?? "",
    values: { opener, share, limit, offset: (first?.span.start ?? paragraph.span.start) + lead },
  };
};

/** Each paragraph that opens with a restating word and repeats at least limit percent of the previous paragraph's words. */
export const paragraphRestatement: Detector = (doc, options): Finding[] => {
  const openers = (doc.lexicons["restating-opener"] ?? []).map((entry) => entry.pattern);
  return doc.paragraphs.flatMap((later, index): Finding[] => {
    const earlier = doc.paragraphs[index - 1];
    const opener = openerOf(later.sentences[0]?.text ?? "", openers);
    if (earlier === undefined || opener === undefined || !isNextTo(doc, earlier, later)) return [];
    const { share, words } = repeatedShare(tokensOf(earlier), tokensAfterOpener(later, opener));
    return words >= MIN_CONTENT_WORDS && share >= options.limit ? [findingOf(later, opener, share, options.limit)] : [];
  });
};
