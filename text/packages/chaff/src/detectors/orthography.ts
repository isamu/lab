import type { Detector, Finding, Sentence } from "../plugin.ts";
import { latinBoundaries, minorityStyle, occurrencesOutside, type SpacingKind } from "../orthography.ts";

/** チームが chaff.yaml の prefer に書いた「使わない書き方」。書いていなければ何も言わない。 */
export const preferredTerm: Detector = (doc, options): Finding[] => {
  const pairs = (options.lexicon ?? []).flatMap((entry) => (entry.instead_of === undefined ? [] : [{ avoid: entry.pattern, use: entry.instead_of }]));
  const hits = doc.sentences.flatMap((sentence) =>
    pairs.flatMap((pair) => occurrencesOutside(sentence.text, pair.avoid, pair.use).map((at) => ({ sentence, at, pair }))),
  );
  if (hits.length === 0 || hits.length < options.limit) return [];
  return hits.map((hit) => ({
    rule: "",
    severity: "warning",
    line: 0,
    column: 0,
    quote: hit.sentence.text.trim(),
    values: { matched: hit.pair.avoid, preferred: hit.pair.use, count: hits.length, limit: options.limit, offset: hit.sentence.span.start + hit.at },
  }));
};

const KIND_NAME: Readonly<Record<SpacingKind, string>> = { letter: "英字", "before-digit": "後ろの数字", "after-digit": "前の数字" };
const KINDS: readonly SpacingKind[] = ["letter", "before-digit", "after-digit"];

type Located = { readonly sentence: Sentence; readonly offset: number; readonly kind: SpacingKind; readonly spaced: boolean };

/**
 * 日本語と英字・数字のあいだを、空けるか詰めるか。文書の中で混ざっていたら、少ないほうを指摘する。
 * どちらが正しいかは決めない。決めるのはチームで、chaff はそろっているかだけを見る。
 */
export const latinSpacing: Detector = (doc, options): Finding[] => {
  const located: Located[] = doc.sentences.flatMap((sentence) =>
    latinBoundaries(sentence.text, doc.source.slice(sentence.span.start, sentence.span.end)).map((boundary) => ({ sentence, ...boundary })),
  );
  return KINDS.flatMap((kind) => {
    const ofKind = located.filter((entry) => entry.kind === kind);
    const minority = minorityStyle(ofKind);
    if (minority === undefined) return [];
    const odd = ofKind.filter((entry) => entry.spaced === minority);
    if (odd.length < options.limit) return [];
    return odd.map((entry) => ({
      rule: "",
      severity: "warning",
      line: 0,
      column: 0,
      quote: entry.sentence.text.trim(),
      values: {
        kind: KIND_NAME[kind],
        style: minority ? "空けています" : "詰めています",
        usual: minority ? "詰める" : "空ける",
        count: odd.length,
        of: ofKind.length,
        limit: options.limit,
        offset: entry.sentence.span.start + entry.offset,
      },
    }));
  });
};
