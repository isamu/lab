import type { Section, Sentence } from "../plugin.ts";

/**
 * 問いの印で終わる見出し。後ろに括弧の注記（(updated Nov. 14, 2024)）が付いてもよい。
 * 「Q1」の札だけでは問いと見ない。四半期（Q1 2024）の見出しと見分けられない。
 */
const QUESTION_END = /[?？]\s*(?:[(（][^()（）]*[)）])?$/u;

export const isQuestionHeading = (heading: string): boolean => QUESTION_END.test(heading.trim());

/** 範囲を決めるのに見るのは、見出しと深さと文だけ。 */
type Heading = Pick<Section, "depth" | "heading" | "sentences">;

type Answer = { readonly depth: number; readonly sentences: Sentence[] };
type Passages = { readonly rest: Sentence[]; readonly answers: Answer[]; readonly open: readonly Answer[] };

/** 節は、それを囲む一番内側の問いの答えに入る。同じ深さか浅い見出しが来れば、その問いは閉じている。 */
const place = (passages: Passages, section: Heading): Passages => {
  const open = passages.open.filter((answer) => answer.depth < section.depth);
  if (isQuestionHeading(section.heading)) {
    const answer = { depth: section.depth, sentences: [...section.sentences] };
    return { ...passages, answers: [...passages.answers, answer], open: [...open, answer] };
  }
  const owner = open.at(-1);
  (owner?.sentences ?? passages.rest).push(...section.sentences);
  return { ...passages, open };
};

/**
 * 言い回しを数える範囲。問いの見出しの下（より深い見出しの「A1」も含む）はそれぞれ一つの答えで、読み手は答えを一つずつ読む。
 * 別の答えで同じ案内（〜をご覧ください）を繰り返しても、書き手が言い直したのではない。問いでない節は、文書全体で一つの範囲。
 */
export const gramPassagesOf = (sections: readonly Heading[]): Sentence[][] => {
  const passages = sections.reduce<Passages>(place, { rest: [], answers: [], open: [] });
  return [passages.rest, ...passages.answers.map((answer) => answer.sentences)].filter((sentences) => sentences.length > 0);
};
