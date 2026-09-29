import { endingTokens, isClosed } from "../sentence-shape.ts";
import { continuesInto, outermostList, registerOf, slipsOf, type Register } from "./register.ts";
import type { Detector, Finding, Sentence } from "../plugin.ts";

/**
 * 文末の調子が混ざっているかを見る。日本語の「ですます / である」がこれ。
 *
 * どちらが正しいかは決めない。決めると、方針の違う書き手にそのまま無視される。
 * 見るのは文書の中での一貫性だけで、少数派のほうを指摘する。spec §12.3 の方針を日本語にも。
 * 終止符で終わらないもの（見出しの下の `MaaSサービス` のような名前だけの行）は文として数えない。
 */
type Entry = { readonly sentence: Sentence; readonly register: Register; readonly group: number | undefined };

const registerOfSentence = (sentence: Sentence, polite: readonly string[]): Register | undefined => {
  const ending = endingTokens(sentence);
  const tokens = sentence.tokens ?? [];
  const head = ending[0] === undefined ? -1 : tokens.indexOf(ending[0]);
  return registerOf(ending, head > 0 ? tokens[head - 1] : undefined, polite);
};

export const sentenceEnding: Detector = (doc, options): Finding[] => {
  const polite = (options.lexicon ?? []).map((entry) => entry.pattern);
  const lists = doc.lists.map((list) => list.span);
  const judged = doc.sentences.flatMap((sentence, index): Entry[] => {
    if (!isClosed(sentence) || continuesInto(sentence, doc.sentences[index + 1])) return [];
    const register = registerOfSentence(sentence, polite);
    return register === undefined ? [] : [{ sentence, register, group: outermostList(sentence.span.start, lists) }];
  });
  return slipsOf(judged, options.limit).map(({ entry: { sentence }, count }) => ({
    rule: "no-mixed-desumasu",
    severity: "warning",
    line: 0,
    column: 0,
    quote: sentence.text.trim(),
    values: { count, limit: options.limit, offset: sentence.span.start },
  }));
};
