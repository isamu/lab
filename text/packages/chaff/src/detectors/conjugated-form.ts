import type { Sentence, Token } from "../plugin.ts";

/**
 * 語彙表が原形で書いた語句（という、と呼ぶ）が、文の中で活用して書かれた形（といいます、と呼びました）。
 * 語句の最後の動詞を原形（lemma）で照らし、その前の部分は字面で照らす。語句を語に分けて並びで照らさないのは、
 * 解析器が単独の「という」を 1 つの助詞に、「といいます」を と・いい・ます に分け、「称し」の原形を 称す とするから。
 * 活用した形は、動詞に続く助動詞（ます、た）まで。品詞が無い文からは何も出ない。
 */

type Run = { readonly start: number; readonly end: number };

/** 動詞と、そのすぐ後ろに続く助動詞の、文の中の範囲。 */
const inflectedRun = (sentence: Sentence, tokens: readonly Token[], index: number, verb: Token): Run => {
  const rest = tokens.slice(index + 1);
  const stop = rest.findIndex((token) => token.pos !== "AUX");
  const last = (stop === -1 ? rest : rest.slice(0, stop)).at(-1) ?? verb;
  return { start: verb.span.start - sentence.span.start, end: last.span.end - sentence.span.start };
};

const formsAt = (sentence: Sentence, tokens: readonly Token[], index: number, bases: readonly string[]): string[] => {
  const verb = tokens[index];
  const lemma = verb?.lemma;
  if (verb?.pos !== "VERB" || lemma === undefined || lemma === "") return [];
  const run = inflectedRun(sentence, tokens, index, verb);
  const before = sentence.text.slice(0, run.start);
  const written = sentence.text.slice(run.start, run.end);
  return bases
    .filter((base) => base.endsWith(lemma))
    .map((base) => base.slice(0, base.length - lemma.length))
    .filter((head) => before.endsWith(head))
    .map((head) => `${head}${written}`);
};

export const conjugatedForms = (sentences: readonly Sentence[], bases: readonly string[]): string[] => {
  const forms = sentences.flatMap((sentence) => {
    const tokens = sentence.tokens ?? [];
    return tokens.flatMap((_token, index) => formsAt(sentence, tokens, index, bases));
  });
  return [...new Set(forms)];
};
