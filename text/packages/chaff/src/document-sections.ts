import type { Heading } from "./document.ts";
import { unlabeledReader } from "./heading-label.ts";
import type { LanguageAdapter, Section, Sentence, Span, Token } from "./plugin.ts";

const within = (span: Span, from: number, to: number): boolean => span.start >= from && span.start < to;

/** 見出しの語。品詞を読んでいない文書（文が tokens を持たない）では分けない。 */
const headingTokensOf = (adapter: LanguageAdapter, tagged: boolean, heading: string): { headingTokens?: readonly Token[] } =>
  tagged && heading !== "" ? { headingTokens: adapter.segment(heading).sentences.flatMap((sentence) => sentence.tokens ?? []) } : {};

type HeadingReaders = { readonly tokensOf: (heading: string) => { headingTokens?: readonly Token[] }; readonly unlabeledOf: (heading: string) => () => string };

/** 見出しから読むもの: 語（品詞を読んだ文書だけ）と、頭の番号の札を除いた題（読まれたときに）。 */
export const headingReadersOf = (adapter: LanguageAdapter, tagged: boolean, lexicons: LanguageAdapter["lexicons"]): HeadingReaders => ({
  tokensOf: (heading) => headingTokensOf(adapter, tagged, heading),
  unlabeledOf: unlabeledReader(adapter.structure, lexicons),
});

export const sectionsOf = (
  headings: readonly Heading[],
  sentences: readonly Sentence[],
  strongs: readonly Span[],
  length: number,
  readers: HeadingReaders,
): Section[] => {
  const bounds = headings.map((heading, index) => ({ heading, from: heading.end, to: headings[index + 1]?.start ?? length }));
  const lead = { heading: { depth: 0, text: "", start: 0, end: 0 }, from: 0, to: headings[0]?.start ?? length };
  return [lead, ...bounds]
    .filter((bound) => bound.to > bound.from)
    .map(({ heading, from, to }) => {
      const inside = sentences.filter((sentence) => within(sentence.span, from, to));
      const unlabeled = readers.unlabeledOf(heading.text);
      return {
        depth: heading.depth,
        heading: heading.text,
        ...readers.tokensOf(heading.text),
        get unlabeledHeading(): string {
          return unlabeled();
        },
        span: { start: from, end: to },
        sentences: inside,
        strongCount: strongs.filter((span) => within(span, from, to)).length,
        firstSentence: inside[0],
      };
    });
};
