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

/**
 * 文末の括弧は、文の終わりではなく添え物。
 *
 * 「これを最優先制約とする（§17）。」の述語は「とする」であって「17」ではない。
 * 仕様書は相互参照を括弧で添えるので、これを数えると文末が全部そこになる。
 */
const TRAILING = /[(（][^(（]*[)）][\s。．！？!?]*$/u;

const beforeTrailing = (sentence: Sentence): readonly Token[] => {
  const tokens = sentence.tokens ?? [];
  const match = TRAILING.exec(sentence.text);
  if (match?.index === undefined) return tokens;
  const cut = sentence.span.start + match.index;
  const kept = tokens.filter((token) => token.span.end <= cut);
  // 括弧を外したら何も残らない文は、括弧そのものが中身。そのまま見る。
  return kept.length === 0 ? tokens : kept;
};

export const lastContent = (sentence: Sentence): Token | undefined => [...beforeTrailing(sentence)].reverse().find((token) => !SKIP.has(token.pos));
