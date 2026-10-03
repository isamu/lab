import type { Detector, DetectorOptions, Finding, Sentence, Span } from "../plugin.ts";
import { occurrencesOutside } from "../orthography.ts";
import { tokenRuns } from "../custom/token-pattern.ts";
import { joinedView, type JoinedView } from "../joined-view.ts";
import { boundedMatches } from "../custom/bounded-match.ts";

// The detectors behind a team's custom_rules. Each reports every place it finds, at the rule's level; the spec comes from
// the rule (DetectorOptions.custom). Positions are the document's, like every other finding.

type Hit = { readonly sentence: Sentence; readonly offset: number; readonly matched: string; readonly preferred: string };

const findingOf = (hit: Hit): Finding => ({
  rule: "",
  severity: "warning",
  line: 0,
  column: 0,
  quote: hit.sentence.text.trim(),
  values: { matched: hit.matched, preferred: hit.preferred, offset: hit.sentence.span.start + hit.offset },
});

/**
 * The sentence with the line breaks that fall inside a word taken out (「関\nする」 reads 「関する」), so words and patterns
 * are found as the reader reads them. Positions found in it go back to the sentence's own.
 */
const readAsWritten = (sentence: Sentence): JoinedView =>
  joinedView(
    sentence.text,
    (sentence.wrapBreaks ?? []).map((span) => ({ start: span.start - sentence.span.start, end: span.end - sentence.span.start })),
  );

/** A match at [start, end) of the joined text, as a hit at the sentence's own position. */
const hitAt = (sentence: Sentence, view: JoinedView, start: number, end: number, preferred: string): Hit => ({
  sentence,
  offset: view.toSource({ start, end }).start,
  matched: view.text.slice(start, end),
  preferred,
});

/** source[start, end) with the line breaks inside words taken out: the text of a run of tokens as the reader reads it. */
const withoutBreaks = (source: string, start: number, end: number, breaks: readonly Span[]): string =>
  breaks
    .filter((span) => span.start >= start && span.end <= end)
    .toReversed()
    .reduce((text, span) => `${text.slice(0, span.start - start)}${text.slice(span.end - start)}`, source.slice(start, end));

/** A words rule's own words, or its word list's in the document's language: each entry's pattern, and its rewrite as the spelling to use. */
const pairsOf = (
  spec: { readonly words: readonly { readonly avoid: string; readonly use: string }[] },
  options: DetectorOptions,
): readonly { avoid: string; use: string }[] =>
  spec.words.length > 0 ? spec.words : (options.lexicon ?? []).map((entry) => ({ avoid: entry.pattern, use: entry.rewrite ?? "" }));

/** words: each spelling to avoid, outside the spelling to use (「ユーザ」 inside 「ユーザー」 is not reported). */
export const customWords: Detector = (doc, options): Finding[] => {
  const spec = options.custom;
  if (spec?.type !== "words") return [];
  const pairs = pairsOf(spec, options).filter((pair) => pair.avoid !== "" && pair.avoid !== pair.use);
  return doc.sentences.flatMap((sentence) => {
    const view = readAsWritten(sentence);
    return pairs.flatMap((pair) =>
      occurrencesOutside(view.text, pair.avoid, pair.use).map((start) => findingOf(hitAt(sentence, view, start, start + pair.avoid.length, pair.use))),
    );
  });
};

/** pattern: each match of the team's regular expression in a sentence. Checked when chaff.yaml was read, and run with a time limit. */
export const customPattern: Detector = (doc, options): Finding[] => {
  const spec = options.custom;
  if (spec?.type !== "pattern") return [];
  const views = doc.sentences.map(readAsWritten);
  const matches = boundedMatches(
    spec.pattern,
    spec.flags,
    views.map((view) => view.text),
  );
  return doc.sentences.flatMap((sentence, at) => {
    const view = views[at];
    if (view === undefined) return [];
    return (matches[at] ?? []).map((match) => findingOf(hitAt(sentence, view, match.index, match.index + match.text.length, "")));
  });
};

/** tokens: each run of tokens that meets the conditions in order, quoted from its first token to its last, line breaks inside words taken out. */
export const customTokens: Detector = (doc, options): Finding[] => {
  const spec = options.custom;
  if (spec?.type !== "tokens") return [];
  return doc.sentences.flatMap((sentence) => {
    const tokens = sentence.tokens ?? [];
    return tokenRuns(tokens, spec.tokens).flatMap(([first, last]) => {
      const [start, end] = [tokens[first]?.span.start, tokens[last]?.span.end];
      if (start === undefined || end === undefined) return [];
      return [
        findingOf({ sentence, offset: start - sentence.span.start, matched: withoutBreaks(doc.source, start, end, sentence.wrapBreaks ?? []), preferred: "" }),
      ];
    });
  });
};
