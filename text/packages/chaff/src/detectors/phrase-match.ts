import type { Detector, DetectorOptions, Finding, Lexicon, ProseDocument, Sentence } from "../plugin.ts";
import { entryIn } from "./lexicon-match.ts";

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

const hitsIn = (sentences: readonly Sentence[], lexicon: Lexicon): Hit[] =>
  sentences.flatMap((sentence) => {
    const matched = lexicon.find((entry) => entryIn(sentence, entry));
    return matched === undefined ? [] : [{ sentence, matched: matched.pattern }];
  });

const findingsOf = (hits: readonly Hit[], limit: number): Finding[] =>
  hits.map((hit) => ({
    rule: "",
    severity: "warning",
    line: 0,
    column: 0,
    quote: hit.sentence.text.trim(),
    values: { matched: hit.matched, count: hits.length, limit, offset: hit.sentence.span.start },
  }));

const phraseHits = (doc: ProseDocument, options: DetectorOptions): Hit[] => {
  const lexicon = options.lexicon ?? [];
  return lexicon.length === 0 ? [] : hitsIn(inScope(doc, options.where), lexicon);
};

/**
 * 語彙表との照合。detector は共通で、語彙だけが言語別に差し替わる。spec §11。
 * これが L2 の全体像で、新しい言語は語彙表を書くだけで動く。limit は指摘に要る数で、1 なら 1 つ目から言う。
 */
export const phraseMatch: Detector = (doc, options): Finding[] => {
  const hits = phraseHits(doc, options);
  return hits.length < options.limit ? [] : findingsOf(hits, options.limit);
};

/** 回数に上限がある語。limit は許す回数で、それを超えたときだけ言う。message の「N 回まで」と同じ向き。 */
export const phraseCount: Detector = (doc, options): Finding[] => {
  const hits = phraseHits(doc, options);
  return hits.length <= options.limit ? [] : findingsOf(hits, options.limit);
};
