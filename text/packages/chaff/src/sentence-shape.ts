import type { Sentence, Token } from "./plugin.ts";

/**
 * 「これは文か」の判定を 1 箇所に置く。
 *
 * 段落として解析されるものには、見出しの下の名前だけの行（`OpenAI`）、引用の出典行、
 * 表題行が混ざる。文として数えると、文書全体を分母にする rule がそこで狂う。
 * 終止符で終わることを条件にすると、そのほとんどが落ちる。
 */
const ENDS = /[。．.！？!?][")）」』\s]*$/u;

export const isClosed = (sentence: Sentence): boolean => ENDS.test(sentence.text);

const PREDICATE = new Set(["AUX", "VERB", "ADJ"]);

export const hasPredicate = (sentence: Sentence): boolean => (sentence.tokens ?? []).some((token) => PREDICATE.has(token.pos));

export const hasParticle = (sentence: Sentence): boolean => (sentence.tokens ?? []).some((token) => token.pos === "ADP" || token.pos === "SCONJ");

const SKIP = new Set(["PUNCT", "PART", "SYM"]);

export const lastContent = (sentence: Sentence): Token | undefined => [...(sentence.tokens ?? [])].reverse().find((token) => !SKIP.has(token.pos));
