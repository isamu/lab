import type { Detector, Finding, ProseDocument, Sentence } from "../plugin.ts";

/** 冒頭は先頭 2 段落ぶん。「どの記事にも当てはまる書き出し」は冒頭にあるときだけ問題。 */
const OPENING_SENTENCES = 4;

/**
 * 見る範囲を絞る。同じ語でも、どこにあるかで意味が変わる。
 * 「まとめると」は結びなら定型だが、本文の途中なら普通の接続。
 */
const inScope = (doc: ProseDocument, where: string | undefined): readonly Sentence[] => {
  if (where === "opening") return doc.sentences.slice(0, OPENING_SENTENCES);
  if (where === "closing") return doc.sections.at(-1)?.sentences ?? [];
  return doc.sentences;
};

type Hit = { readonly sentence: Sentence; readonly matched: string };

const hitsIn = (sentences: readonly Sentence[], patterns: readonly string[]): Hit[] =>
  sentences.flatMap((sentence) => {
    const matched = patterns.find((pattern) => sentence.text.toLowerCase().includes(pattern.toLowerCase()));
    return matched === undefined ? [] : [{ sentence, matched }];
  });

/**
 * 語彙表との照合。detector は共通で、語彙だけが言語別に差し替わる。spec §11。
 * これが L2 の全体像で、新しい言語は語彙表を書くだけで動く。
 */
export const phraseMatch: Detector = (doc, options): Finding[] => {
  const patterns = (options.lexicon ?? []).map((entry) => entry.pattern);
  if (patterns.length === 0) return [];
  const hits = hitsIn(inScope(doc, options.where), patterns);
  if (hits.length < options.limit) return [];
  return hits.map((hit) => ({
    rule: "",
    severity: "warning",
    line: 0,
    column: 0,
    quote: hit.sentence.text.trim(),
    values: { matched: hit.matched, count: hits.length, limit: options.limit, offset: hit.sentence.span.start },
  }));
};
