import { isContent } from "./content-morphemes.ts";
import type { Span, Token } from "../plugin.ts";

/** 文の結びだけを作る語: 動詞にするだけの語と非自立の動詞（し、まいり）、助動詞（ます）、て・で、句点。中身の語は isContent が外す。 */
const ENDING_POS = new Set(["VERB", "AUX", "SCONJ", "PUNCT"]);

/** 文を閉じる記号。読点（しておりますが、）で終わる語句は文の途中。 */
const SENTENCE_STOP = /^[。．.!?！？]$/u;

const overlaps = (token: Token, window: Span): boolean => token.span.start < window.end && window.start < token.span.end;

/**
 * 語句が文の結びだけでできているか（してまいります。、てまいりました。）。結びの単調さは repeated-sentence-ending が見るので、言い回しとしては数えない。
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
