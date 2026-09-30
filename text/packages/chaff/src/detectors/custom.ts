import type { Detector, Finding, Sentence } from "../plugin.ts";
import { occurrencesOutside } from "../orthography.ts";
import { tokenRuns } from "../custom/token-pattern.ts";

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

/** words: each spelling to avoid, outside the spelling to use (「ユーザ」 inside 「ユーザー」 is not reported). */
export const customWords: Detector = (doc, options): Finding[] => {
  const spec = options.custom;
  if (spec?.type !== "words") return [];
  return doc.sentences.flatMap((sentence) =>
    spec.words.flatMap((pair) =>
      occurrencesOutside(sentence.text, pair.avoid, pair.use).map((offset) =>
        findingOf({ sentence, offset, matched: sentence.text.slice(offset, offset + pair.avoid.length), preferred: pair.use }),
      ),
    ),
  );
};

/** pattern: each match of the team's regular expression in a sentence. The pattern was checked when chaff.yaml was read. */
export const customPattern: Detector = (doc, options): Finding[] => {
  const spec = options.custom;
  if (spec?.type !== "pattern") return [];
  const pattern = new RegExp(spec.pattern, `g${spec.flags}`);
  return doc.sentences.flatMap((sentence) =>
    [...sentence.text.matchAll(pattern)]
      .filter((match) => match[0] !== "")
      .map((match) => findingOf({ sentence, offset: match.index, matched: match[0], preferred: "" })),
  );
};

/** tokens: each run of tokens that meets the conditions in order, quoted as written from its first token to its last. */
export const customTokens: Detector = (doc, options): Finding[] => {
  const spec = options.custom;
  if (spec?.type !== "tokens") return [];
  return doc.sentences.flatMap((sentence) => {
    const tokens = sentence.tokens ?? [];
    return tokenRuns(tokens, spec.tokens).flatMap(([first, last]) => {
      const [start, end] = [tokens[first]?.span.start, tokens[last]?.span.end];
      if (start === undefined || end === undefined) return [];
      const offset = start - sentence.span.start;
      return [findingOf({ sentence, offset, matched: doc.source.slice(start, end), preferred: "" })];
    });
  });
};
