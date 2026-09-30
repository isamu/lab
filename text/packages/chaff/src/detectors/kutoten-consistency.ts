import type { Detector, Finding, Sentence, Span } from "../plugin.ts";
import { minorityStyle } from "../orthography.ts";
import { isWithinAny, quotedSpans } from "../quoted-span.ts";

/** 日本語の読点と句点の、二つの書き方。「、。」と、横書きの論文や公用文に多い「，．」。どちらが正しいかは決めない。 */
type Kind = { readonly id: "comma" | "period"; readonly usual: string; readonly western: string };

const KINDS: readonly Kind[] = [
  { id: "comma", usual: "、", western: "，" },
  { id: "period", usual: "。", western: "．" },
];

const MARKS = /[、，。．]/gu;

const DIGIT = /[\d０-９]/u;
const LATIN = /[A-Za-zＡ-Ｚａ-ｚ]/u;

/**
 * 句読点として数えない「，」「．」。数の中の桁の区切りと小数点（１，０００、３．５）、番号の後ろの点（１．はじめに）、
 * 英字の後ろの点（Ｑ．、No．）は、日本語の文の区切りではない。
 */
const isNotPunctuation = (text: string, at: number, mark: string): boolean => {
  const before = text.charAt(at - 1);
  if (mark === "．") return DIGIT.test(before) || LATIN.test(before);
  if (mark === "，") return LATIN.test(before) || (DIGIT.test(before) && DIGIT.test(text.charAt(at + 1)));
  return false;
};

export type Mark = { readonly kind: Kind["id"]; readonly western: boolean; readonly mark: string; readonly offset: number };

/** 文の中の句読点。鉤括弧で引いたものの中は、引いた元の書き方なので数えない。offset は文書の中の位置。 */
export const marksIn = (sentence: Sentence): Mark[] => {
  const quoted: readonly Span[] = quotedSpans(sentence.text);
  return [...sentence.text.matchAll(MARKS)]
    .filter((match) => !isNotPunctuation(sentence.text, match.index, match[0]))
    .filter((match) => !isWithinAny(quoted, { start: match.index, end: match.index }))
    .map((match) => {
      const western = match[0] === "，" || match[0] === "．";
      const kind = match[0] === "、" || match[0] === "，" ? "comma" : "period";
      return { kind, western, mark: match[0], offset: sentence.span.start + match.index };
    });
};

/** 注の番号と空白で始まる行（白書の「2 亀田健司，「…」，2018年」）。白書や論文の注と文献は、本文と違う区切り方で書く決まりがある。 */
const NOTE_NUMBER = /^[\d０-９]{1,3}[\u3000 ]/u;

const URL_SCHEME = /https?:\/\//u;

/** 文献や出典を挙げた文。注の番号で始まるか、URL を含む。区切りは引いた元や文献の書き方に従う。 */
export const isCitation = (sentence: Sentence, source: string): boolean =>
  NOTE_NUMBER.test(sentence.text.trimStart()) || URL_SCHEME.test(source.slice(sentence.span.start, sentence.span.end));

type Tally = { readonly count: number; readonly of: number; readonly limit: number };

const findingOf = (sentence: Sentence, entry: Mark, kind: Kind, tally: Tally): Finding => ({
  rule: "",
  severity: "warning",
  line: 0,
  column: 0,
  quote: sentence.text.trim(),
  values: { mark: entry.mark, usual: entry.western ? kind.usual : kind.western, ...tally, offset: entry.offset },
  variant: entry.kind,
});

/**
 * 読点（、と，）と句点（。と．）を、それぞれ文書の中でどちらかにそろえているか。混ざっていれば少ないほうを指摘する。
 * latin-spacing と同じく、同数なら文書が先に使った書き方をその文書の書き方とする。
 */
export const kutotenConsistency: Detector = (doc, options): Finding[] => {
  const located = doc.sentences
    .filter((sentence) => !isCitation(sentence, doc.source))
    .flatMap((sentence) => marksIn(sentence).map((entry) => ({ sentence, entry })));
  return KINDS.flatMap((kind) => {
    const ofKind = located.filter(({ entry }) => entry.kind === kind.id);
    const minority = minorityStyle(ofKind.map(({ entry }) => ({ spaced: entry.western })));
    if (minority === undefined) return [];
    const odd = ofKind.filter(({ entry }) => entry.western === minority);
    if (odd.length < options.limit) return [];
    const tally = { count: odd.length, of: ofKind.length, limit: options.limit };
    return odd.map(({ sentence, entry }) => findingOf(sentence, entry, kind, tally));
  });
};
