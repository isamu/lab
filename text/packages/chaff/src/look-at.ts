import type { ProseDocument } from "./plugin.ts";
import type { Candidate } from "./semantic.ts";

/**
 * 自然文で書かれた `look_at` を、決定的な絞り込みに変える。spec §14、§26-7。
 *
 * 変換に LLM も対話も使わない。書き手は「どこを見るか」を説明するとき、
 * 見るべき語を**自然に括弧でくくる**。
 *
 *   look_at: 「お願いします」「ご確認ください」を含む文
 *
 * その括弧の中を取り出すだけで、文単位の絞り込みになる。
 * 推測を足さないので、書いたものと動くものが一致する。
 */
const QUOTED = /[「『"'`]([^「『』」"'`]{1,40})[」』"'`]/gu;

export const wordsFrom = (lookAt: string | undefined): string[] => {
  if (lookAt === undefined) return [];
  const found = [...lookAt.matchAll(QUOTED)].map((match) => match[1]?.trim() ?? "").filter((word) => word.length > 0);
  return [...new Set(found)];
};

/** 数値を見ると書いてあれば、数字のある文に限る。 */
const WANTS_NUMBER = /数値|数字|number|figure/iu;

export type Narrowing = { readonly words: readonly string[]; readonly needsNumber: boolean; readonly kept: number; readonly total: number };

const NUMBER = /\d/u;

const matches = (text: string, words: readonly string[], needsNumber: boolean): boolean => {
  if (needsNumber && !NUMBER.test(text)) return false;
  return words.length === 0 || words.some((word) => text.includes(word));
};

/**
 * 絞り込めたら文単位で、絞り込めなければ文書全体を渡す。
 * 全体を渡すときは「絞り込めなかった」ことを呼ぶ側に返す。黙って高いほうを選ばない。
 */
export const narrow = (
  doc: ProseDocument,
  lookAt: string | undefined,
  whole: (doc: ProseDocument) => Candidate[],
): { candidates: Candidate[]; narrowing: Narrowing } => {
  const words = wordsFrom(lookAt);
  const needsNumber = lookAt !== undefined && WANTS_NUMBER.test(lookAt);
  const total = doc.sentences.length;
  if (words.length === 0 && !needsNumber) return { candidates: whole(doc), narrowing: { words, needsNumber, kept: total, total } };
  const hits = doc.sentences.filter((sentence) => matches(sentence.text, words, needsNumber));
  return {
    candidates: hits.map((sentence) => ({ text: sentence.text.trim(), offset: sentence.span.start })),
    narrowing: { words, needsNumber, kept: hits.length, total },
  };
};
