import { joinWords } from "./word-list.ts";
import { conjugatedSpans } from "./conjugated-entry.ts";
import type { Detector, Finding, LexiconEntry, ProseDocument, Sentence, Span } from "../plugin.ts";

/**
 * チームの言葉。社内でしか通じない語を、チームが chaff.yaml に自分で並べる。
 *
 * 何が社内用語かは組織ごとに違うので、chaff は語を持たない。並べる場所だけを用意する。
 * 語彙表が空なら何も言わない（「用語を登録してください」とも言わない。押しつけない）。
 */
/**
 * 表層でも原形でも当てる。利用者は辞書形で書く（「握る」）が、本文は活用している（「握った」）。
 * 複合動詞（「巻き取る」）は語に割れるので、語の並びで原形に照らす（「巻き取ります」）。
 * 品詞解析があれば原形で当たり、無くても表層で当たる。要求はしない。
 */
const textSpans = (sentence: Sentence, wanted: string): Span[] => {
  const at = sentence.text.toLowerCase().indexOf(wanted);
  return at < 0 ? [] : [{ start: at, end: at + wanted.length }];
};

const lemmaSpans = (sentence: Sentence, wanted: string): Span[] =>
  (sentence.tokens ?? [])
    .filter((token) => token.lemma?.toLowerCase() === wanted)
    .map((token) => ({ start: token.span.start - sentence.span.start, end: token.span.end - sentence.span.start }));

/** 活用した形の後ろに詰めて付く語（握っ|た・巻き取り|ます）。指摘には本文に書いた形を引く。 */
const ENDING_POS = new Set(["AUX", "SCONJ"]);

/**
 * 当たった範囲を、本文に書いた形まで伸ばす。語の途中で終われば語の終わりまで（巻き取 → 巻き取り）、
 * 詰めて付いた助動詞まで（握っ → 握った）。語の間に空白がある英語は、後ろの語まで伸ばさない。
 */
const writtenSpan = (sentence: Sentence, span: Span): Span => {
  const end = sentence.span.start + span.end;
  const tokens = sentence.tokens ?? [];
  const inside = tokens.find((token) => token.span.start < end && end < token.span.end);
  const next = tokens.find((token) => token.span.start === end && ENDING_POS.has(token.pos));
  const reach = inside ?? next;
  return reach === undefined ? span : writtenSpan(sentence, { start: span.start, end: reach.span.end - sentence.span.start });
};

/** 並べた語が文のどこに出たか（文の中の字の範囲）。表層、原形、複合動詞の活用した形の順に、最初の 1 か所。 */
const firstSpan = (sentence: Sentence, entry: LexiconEntry): Span | undefined => {
  // 大文字小文字は区別しない。英語の文頭の「Circle back」も「circle back」として当てる。
  const wanted = entry.pattern.toLowerCase();
  const found = [...textSpans(sentence, wanted), ...lemmaSpans(sentence, wanted), ...conjugatedSpans(sentence, entry)][0];
  return found === undefined ? undefined : writtenSpan(sentence, found);
};

const covers = (outer: Span, inner: Span): boolean => outer !== inner && outer.start <= inner.start && inner.end <= outer.end;

/** 文に出た、並べた語のそれぞれ。並べた語どうしが重なれば（握る・握っておく）、長い方だけ。 */
const sentenceHits = (sentence: Sentence, entries: readonly LexiconEntry[]): Span[] => {
  const spans = entries.flatMap((entry) => {
    const span = firstSpan(sentence, entry);
    return span === undefined ? [] : [span];
  });
  const distinct = spans.filter((span, index) => spans.findIndex((other) => other.start === span.start && other.end === span.end) === index);
  return distinct.filter((span) => !distinct.some((other) => covers(other, span))).toSorted((left, right) => left.start - right.start);
};

export const internalJargon: Detector = (doc, options): Finding[] => {
  const entries = options.lexicon ?? [];
  if (entries.length === 0) return [];
  const hits = doc.sentences.flatMap((sentence) => sentenceHits(sentence, entries).map((span) => ({ sentence, span })));
  if (hits.length < options.limit) return [];
  return hits.map((hit) => ({
    rule: "internal-jargon",
    severity: "warning",
    line: 0,
    column: 0,
    quote: hit.sentence.text.trim(),
    values: {
      matched: hit.sentence.text.slice(hit.span.start, hit.span.end),
      count: hits.length,
      limit: options.limit,
      offset: hit.sentence.span.start + hit.span.start,
    },
  }));
};

const has = (headings: readonly string[], wanted: string): boolean => headings.some((heading) => heading.includes(wanted));

/** The wanted sections no heading names. A heading names one when it contains it: 「主なリスク」 has 「リスク」. */
export const missingSections = (doc: Pick<ProseDocument, "sections">, wanted: readonly string[]): string[] => {
  const headings = doc.sections.map((section) => section.heading);
  return wanted.filter((name) => !has(headings, name));
};

/**
 * この種類の文書に無いと困る見出し。チームが chaff.yaml で決める。
 *
 * 「提案書にはリスクの節がある」のような取り決めは、組織ごとに違う。
 * chaff は必須の見出しを持たず、**書かれた取り決めを守れているかだけ**を見る。
 */
export const requiredSections: Detector = (doc, options): Finding[] => {
  const wanted = doc.requiredSections;
  if (wanted.length === 0) return [];
  const missing = missingSections(doc, wanted);
  if (missing.length < options.limit) return [];
  return [
    {
      rule: "required-sections",
      severity: "error",
      line: 0,
      column: 0,
      quote: doc.sections
        .map((section) => section.heading)
        .filter((heading) => heading.length > 0)
        .join(" / "),
      values: { word: joinWords(missing, doc.language), count: missing.length, limit: options.limit, offset: 0 },
    },
  ];
};
