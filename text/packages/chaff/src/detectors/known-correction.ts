import type { Detector, Finding, LexiconEntry, ProseDocument, Sentence } from "../plugin.ts";
import { entryRanges } from "./lexicon-match.ts";
import { escapeRegExp } from "../orthography.ts";
import { correctionIn, editBetween, type Correction, type Edit } from "../correction-edit.ts";

/** 語彙表の一組。pattern が誤った形、instead_of が正しい形。 */
type Pair = { readonly entry: LexiconEntry; readonly wrong: string; readonly edit: Edit };

/** 見つけた誤り 1 つ。offset は文書の上の位置。 */
type Hit = { readonly sentence: Sentence; readonly offset: number; readonly correction: Correction };

const pairsOf = (entries: readonly LexiconEntry[]): Pair[] =>
  entries.flatMap((entry) =>
    entry.instead_of === undefined || entry.pattern === "" ? [] : [{ entry, wrong: entry.pattern, edit: editBetween(entry.pattern, entry.instead_of) }],
  );

const LATIN_EDGE = /[A-Za-z0-9]/u;

/** 英字の語は語の途中に当てない（"teh" は "Tehran" の中に無い）。かなと漢字は字で語の切れ目を決められないので、品詞が無ければ字の並びで照らす。 */
const wordPattern = (wrong: string): RegExp => {
  const before = LATIN_EDGE.test(wrong.charAt(0)) ? "(?<![\\p{L}\\p{N}])" : "";
  const after = LATIN_EDGE.test(wrong.charAt(wrong.length - 1)) ? "(?![\\p{L}\\p{N}])" : "";
  return new RegExp(`${before}${escapeRegExp(wrong)}${after}`, "giu");
};

const hitAt = (sentence: Sentence, start: number, correction: Correction | undefined): Hit[] =>
  correction === undefined ? [] : [{ sentence, offset: start, correction }];

/** 品詞が無い文。字の並びで、英字の語の切れ目を守って照らす。指すのは当たった字全体。 */
const textHits = (sentence: Sentence, pair: Pair): Hit[] =>
  [...sentence.text.matchAll(wordPattern(pair.wrong))].flatMap((match) =>
    hitAt(sentence, sentence.span.start + match.index, correctionIn(match[0], pair.wrong, pair.edit, [match[0].length])),
  );

/** 品詞のある文。語の並びで照らすので、語の途中には当たらない（「ですすべて」の「ですす」）。指すのは違う所を含む語まで。 */
const tokenHits = (sentence: Sentence, pair: Pair, source: string): Hit[] => {
  const tokens = sentence.tokens ?? [];
  return entryRanges(sentence, pair.entry).flatMap((range) => {
    const words = tokens.slice(range.start, range.end);
    const start = words[0]?.span.start ?? 0;
    const written = source.slice(start, words.at(-1)?.span.end ?? start);
    const boundaries = words.map((word) => word.span.end - start);
    return written === "" ? [] : hitAt(sentence, start, correctionIn(written, pair.wrong, pair.edit, boundaries));
  });
};

/** 字の並びで当たった所のうち、両端が文の語の切れ目にあるもの。語彙表の語を解析器が文の中と違う切り方にした（「ますす」）ときの拾い直し。 */
const alignedTextHits = (sentence: Sentence, pair: Pair): Hit[] => {
  const tokens = sentence.tokens ?? [];
  const starts = new Set(tokens.map((token) => token.span.start));
  const ends = new Set(tokens.map((token) => token.span.end));
  return textHits(sentence, pair).filter((hit) => starts.has(hit.offset) && ends.has(hit.offset + pair.wrong.length));
};

const hitsIn = (sentence: Sentence, pair: Pair, source: string): Hit[] => {
  if (sentence.tokens === undefined || (pair.entry.tokens?.length ?? 0) === 0) return textHits(sentence, pair);
  return [...tokenHits(sentence, pair, source), ...alignedTextHits(sentence, pair)];
};

/** チームが names に並べた名前の中の字（「黒ひげ危機一発」の「危機一発」）は、その字のまま正しい。 */
const isInTeamName = (doc: ProseDocument, hit: Hit): boolean =>
  (doc.names ?? []).some((name) =>
    [...hit.sentence.text.matchAll(new RegExp(escapeRegExp(name), "giu"))].some((match) => {
      const start = hit.sentence.span.start + match.index;
      return start <= hit.offset && hit.offset + hit.correction.matched.length <= start + match[0].length;
    }),
  );

/** 一つの所に二つの組が当たったら、語彙表で先に書いた組だけ。 */
const firstAtEachOffset = (hits: readonly Hit[]): Hit[] => hits.filter((hit, at) => hits.findIndex((other) => other.offset === hit.offset) === at);

/**
 * 誤りと正しい形の組の語彙表（pattern が誤り、instead_of が正しい形）。文書の中で誤った形を見つけ、正しい形を添えて言う。
 * どの組を誤りとするかは語彙表が決め、detector は語の切れ目と大文字と、組のどこが違うかだけを扱う。
 */
export const knownCorrection: Detector = (doc, options): Finding[] => {
  const pairs = pairsOf(options.lexicon ?? []);
  const hits = doc.sentences.flatMap((sentence) => pairs.flatMap((pair) => hitsIn(sentence, pair, doc.source)));
  return firstAtEachOffset(hits.toSorted((left, right) => left.offset - right.offset))
    .filter((hit) => !isInTeamName(doc, hit))
    .map((hit) => ({
      rule: "",
      severity: "warning",
      line: 0,
      column: 0,
      quote: hit.sentence.text.trim(),
      values: { matched: hit.correction.matched, suggestion: hit.correction.suggestion, offset: hit.offset },
    }));
};
