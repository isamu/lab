import type { Detector, Finding, Sentence, Span } from "../plugin.ts";
import { latinBoundaries, minorityStyle, occurrencesOutside, type Boundary, type SpacingKind } from "../orthography.ts";
import { isWithinAny, quotedSpans } from "../quoted-span.ts";
import { digitRunAround, isNumberName, sequenceLabelStarts } from "../number-name.ts";

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

/** 境目の隣の数字の、並びの中の 1 字の位置。数字の後ろなら左の字、数字の前なら（空白を越えた）右の字。 */
const digitBeside = (boundary: Boundary): number => {
  if (boundary.kind === "after-digit") return boundary.offset - 1;
  return boundary.spaced ? boundary.offset + 1 : boundary.offset;
};

/** 番号・識別子として書かれた数の境目は、空け方の好みではないので数えない（number-name.ts）。 */
const isCounted = (sentence: Sentence, boundary: Boundary, sequence: ReadonlySet<number>, topUnits: ReadonlySet<string>): boolean => {
  if (boundary.kind === "letter") return true;
  const run = digitRunAround(sentence.text, digitBeside(boundary));
  return run === undefined || !isNumberName(sentence.text, run, sentence.tokens, sentence.span.start, sequence, topUnits);
};

/**
 * 鉤括弧で引いた題名や発言（「…ガイドライン ver. 1.1」）の中の境目。空け方は引いた元のもので、書き手の書き方ではない。
 * 括弧は日本語の字でも英数字でもないので、境目はまるごと括弧の中か外にある。
 */
const isQuoted = (quoted: readonly Span[], boundary: Boundary): boolean => isWithinAny(quoted, { start: boundary.offset, end: boundary.offset });

/**
 * 日本語と英字・数字のあいだを、空けるか詰めるか。文書の中で混ざっていたら、少ないほうを指摘する。
 * どちらが正しいかは決めない。決めるのはチームで、chaff はそろっているかだけを見る。
 */
export const latinSpacing: Detector = (doc, options): Finding[] => {
  // 覆った文（prose）で探す。コードの中の「1 件」は並びに入れない。
  const sequence = sequenceLabelStarts(doc.prose ?? doc.source);
  const topUnits = new Set((doc.lexicons["prefecture-unit"] ?? []).map((entry) => entry.pattern));
  const located: Located[] = doc.sentences.flatMap((sentence) => {
    const quoted = quotedSpans(sentence.text);
    return latinBoundaries(sentence.text, doc.source.slice(sentence.span.start, sentence.span.end))
      .filter((boundary) => !isQuoted(quoted, boundary) && isCounted(sentence, boundary, sequence, topUnits))
      .map((boundary) => ({ sentence, ...boundary }));
  });
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
