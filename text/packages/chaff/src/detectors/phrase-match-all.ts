import type { Detector, Finding, Lexicon, Sentence } from "../plugin.ts";
import { entryEnds } from "./lexicon-match.ts";
import { quotedPattern } from "./quoted-pattern.ts";

/**
 * phrase-match の、文の中の違う言い回しをみな名指す版。指摘は phrase-match と同じく文ごとに一つで、位置も文の頭。
 * 一つの文に「ないわけではありません」と「ないとは限りません」があれば、一つ目だけを言うと二つ目を直し忘れる。
 * 重なる二つの語が同じ位置で終われば一回で、名指すのは語彙表で先に書いた語。並びは文の中で終わる順。
 */
type Named = { readonly sentence: Sentence; readonly phrases: readonly string[] };

const firstEnds = (sentence: Sentence, lexicon: Lexicon): { readonly phrase: string; readonly end: number }[] =>
  lexicon.flatMap((entry) => {
    const ends = entryEnds(sentence, entry);
    return ends.length === 0 ? [] : [{ phrase: quotedPattern(entry.pattern), end: Math.min(...ends) }];
  });

const phrasesIn = (sentence: Sentence, lexicon: Lexicon): string[] => {
  const byEnd = new Map<number, string>();
  firstEnds(sentence, lexicon).forEach(({ phrase, end }) => {
    if (!byEnd.has(end)) byEnd.set(end, phrase);
  });
  const ordered = [...byEnd].toSorted(([left], [right]) => left - right).map(([, phrase]) => phrase);
  return [...new Set(ordered)];
};

/** 違う言い回しが二つなら both、三つ以上なら many の文言。 */
const variantOf = (kinds: number): Pick<Finding, "variant"> => {
  if (kinds === 2) return { variant: "both" };
  return kinds > 2 ? { variant: "many" } : {};
};

const findingOf = ({ sentence, phrases }: Named, count: number, limit: number): Finding => ({
  rule: "",
  severity: "warning",
  line: 0,
  column: 0,
  quote: sentence.text.trim(),
  ...variantOf(phrases.length),
  values: {
    matched: phrases[0] ?? "",
    ...(phrases.length > 1 ? { other: phrases[1] ?? "", kinds: phrases.length } : {}),
    count,
    limit,
    offset: sentence.span.start,
  },
});

export const phraseMatchAll: Detector = (doc, options): Finding[] => {
  const lexicon = options.lexicon ?? [];
  if (lexicon.length === 0) return [];
  const named = doc.sentences.flatMap((sentence) => {
    const phrases = phrasesIn(sentence, lexicon);
    return phrases.length === 0 ? [] : [{ sentence, phrases }];
  });
  return named.length < options.limit ? [] : named.map((item) => findingOf(item, named.length, options.limit));
};
