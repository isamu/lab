import { joinWords } from "./word-list.ts";
import { conjugatedSpans } from "./conjugated-entry.ts";
import type { Detector, Finding, LexiconEntry, ProseDocument, Sentence } from "../plugin.ts";

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
const matches = (sentence: Sentence, entry: LexiconEntry): boolean => {
  // 大文字小文字は区別しない。英語の文頭の「Circle back」も「circle back」として当てる。
  const wanted = entry.pattern.toLowerCase();
  return (
    sentence.text.toLowerCase().includes(wanted) ||
    (sentence.tokens ?? []).some((token) => token.lemma?.toLowerCase() === wanted) ||
    conjugatedSpans(sentence, entry).length > 0
  );
};

export const internalJargon: Detector = (doc, options): Finding[] => {
  const entries = options.lexicon ?? [];
  if (entries.length === 0) return [];
  const hits = doc.sentences.flatMap((sentence) => {
    const matched = entries.find((entry) => matches(sentence, entry))?.pattern;
    return matched === undefined ? [] : [{ sentence, matched }];
  });
  if (hits.length < options.limit) return [];
  return hits.map((hit) => ({
    rule: "internal-jargon",
    severity: "warning",
    line: 0,
    column: 0,
    quote: hit.sentence.text.trim(),
    values: { matched: hit.matched, count: hits.length, limit: options.limit, offset: hit.sentence.span.start },
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
