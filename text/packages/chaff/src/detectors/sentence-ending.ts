import { hasPredicate, isClosed } from "../sentence-shape.ts";
import type { Detector, Finding, Sentence } from "../plugin.ts";

/**
 * 文末の調子が混ざっているかを見る。日本語の「ですます / である」がこれ。
 *
 * どちらが正しいかは決めない。決めると、方針の違う書き手にそのまま無視される。
 * 見るのは文書の中での一貫性だけで、少数派のほうを指摘する。spec §12.3 の方針を日本語にも。
 */
/**
 * 述語を持たないものは文として数えない。見出しの下の `MaaSサービス` のような
 * 名前だけの行がそのまま「である調」の少数派になり、実文書の誤検知はすべてこれだった。
 */
const isSentence = (sentence: Sentence): boolean => isClosed(sentence) && hasPredicate(sentence);

const isPolite = (sentence: Sentence, polite: readonly string[]): boolean =>
  (sentence.tokens ?? []).some((token) => polite.includes(token.lemma ?? token.surface));

export const sentenceEnding: Detector = (doc, options): Finding[] => {
  const polite = (options.lexicon ?? []).map((entry) => entry.pattern);
  const judged = doc.sentences.filter(isSentence).map((sentence) => ({ sentence, polite: isPolite(sentence, polite) }));
  const counts = { polite: judged.filter((entry) => entry.polite).length, plain: judged.length - judged.filter((entry) => entry.polite).length };
  const minorityIsPolite = counts.polite <= counts.plain;
  const few = minorityIsPolite ? counts.polite : counts.plain;
  // 片方しか無ければ一貫している。少数派が閾値を超えて多ければ、混在ではなく別の文体。
  if (few === 0 || few > options.limit) return [];
  return judged
    .filter((entry) => entry.polite === minorityIsPolite)
    .map(({ sentence }) => ({
      rule: "no-mixed-desumasu",
      severity: "warning",
      line: 0,
      column: 0,
      quote: sentence.text.trim(),
      values: { count: few, limit: options.limit, offset: sentence.span.start },
    }));
};
