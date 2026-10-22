import type { Detector, Finding, Lexicon, ProseDocument, Sentence } from "../plugin.ts";
import { entryEnds, entryIn } from "./lexicon-match.ts";
import { wordsOf } from "./structure.ts";
import { MIN_DOCUMENT_LENGTH } from "./signals.ts";

const PER = 1000;
const TENTHS = 10;
/** 一つ二つは普通の言い方。三つ目から数える。 */
const MIN_USES = 3;
/** 「everyone」だけを繰り返す文書（チームの全員）は、決まった言い方が一つあるだけで、一般化を重ねてはいない。 */
const MIN_PHRASES = 2;

/** 一つの文の、大きく括る言い方。使った回数だけ並ぶ。 */
export type SweepingSentence = { readonly sentence: Sentence; readonly phrases: readonly string[] };

const usesIn = (sentence: Sentence, lexicon: Lexicon): string[] => lexicon.flatMap((entry) => entryEnds(sentence, entry).map(() => entry.pattern));

/** 大きく括る言い方を使った文。weasel-word が言う文（most people agree）は、同じ文を二度言わないので数えない。 */
export const sweepingSentences = (doc: ProseDocument, lexicon: Lexicon): SweepingSentence[] => {
  const weasel = doc.lexicons["weasel-word"] ?? [];
  return doc.sentences
    .filter((sentence) => sentence.embeddedLanguage === undefined && !weasel.some((entry) => entryIn(sentence, entry)))
    .map((sentence) => ({ sentence, phrases: usesIn(sentence, lexicon) }))
    .filter((found) => found.phrases.length > 0);
};

const findingOf = (found: SweepingSentence, values: Readonly<Record<string, number>>): Finding => ({
  rule: "",
  severity: "info",
  line: 0,
  column: 0,
  quote: found.sentence.text.trim(),
  values: { matched: found.phrases[0] ?? "", ...values, offset: found.sentence.span.start },
});

/** 大きく括る言い方（most people、nobody）の 1000 語あたりの数。二種類以上を三つ以上使い、上限を超えたら、使った文をすべて言う。 */
export const overGeneralClaim: Detector = (doc, options): Finding[] => {
  const found = sweepingSentences(doc, options.lexicon ?? []);
  const uses = found.flatMap((entry) => entry.phrases);
  const length = wordsOf(doc);
  if (uses.length < MIN_USES || new Set(uses).size < MIN_PHRASES || length < MIN_DOCUMENT_LENGTH[doc.lengthUnit]) return [];
  const density = Math.round((uses.length / length) * PER * TENTHS) / TENTHS;
  return density <= options.limit ? [] : found.map((entry) => findingOf(entry, { count: uses.length, density, limit: options.limit }));
};
