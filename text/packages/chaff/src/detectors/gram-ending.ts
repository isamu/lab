import { isContent } from "./content-morphemes.ts";
import { endingRuns } from "./clause-shape.ts";
import type { Paragraph, Sentence, Span, Token } from "../plugin.ts";

/** 文の結びだけを作る語: 動詞にするだけの語と非自立の動詞（し、まいり）、助動詞（ます）、て・で、句点。中身の語は isContent が外す。 */
const ENDING_POS = new Set(["VERB", "AUX", "SCONJ", "PUNCT"]);

/** 文を閉じる記号。読点（しておりますが、）で終わる語句は文の途中。 */
const SENTENCE_STOP = /^[。．.!?！？]$/u;

/** 続けて同じ形で終わる文の並びの、一番短い長さ。 */
const MIN_RUN_SENTENCES = 2;

const overlaps = (token: Token, window: Span): boolean => token.span.start < window.end && window.start < token.span.end;

/**
 * 語句が文の結びだけでできているか（してまいります。、てまいりました。）。
 * 中身の語に触れれば、窓の端で切れていても言い回し（取り組んでまいります。、実施しております。）。
 */
export const isSentenceEndingOnly = (tokens: readonly Token[], window: Span): boolean => {
  const touched = tokens.filter((token) => overlaps(token, window) && token.surface.trim() !== "");
  return (
    SENTENCE_STOP.test(touched.at(-1)?.surface ?? "") &&
    touched.some((token) => token.pos === "AUX") &&
    touched.every((token) => ENDING_POS.has(token.pos) && !isContent(token))
  );
};

/**
 * 段落の中で、前か後ろの文と同じ形で終わる文（repeated-sentence-ending が数える並び、clause-shape.ts）。並びの中の結びの繰り返しは
 * 文末の単調さで、その rule が見る。離れた所で何度も出る結び（演説の節ごとの 〜を実現してまいります。）は言い回しの癖として残る。
 */
export const sentencesInEndingRuns = (paragraphs: readonly Paragraph[], eras: readonly string[]): ReadonlySet<Sentence> =>
  new Set(
    paragraphs.flatMap((paragraph) =>
      endingRuns(paragraph.sentences, eras)
        .filter((run) => run.length >= MIN_RUN_SENTENCES)
        .flatMap((run) => run.map(({ sentence }) => sentence)),
    ),
  );
