import { endingTokens, isClosed } from "../sentence-shape.ts";
import { enumeratedRuns, itemStarts } from "./enumerated-runs.ts";
import { continuesInto, groupOf, registerOf, slipsOf, type Register } from "./register.ts";
import type { Detector, Finding, ProseDocument, Sentence, Span } from "../plugin.ts";

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
  return registerOf(ending, head > 0 ? tokens.slice(0, head) : [], polite);
};

/** 番号で始まる段落の並び。木を組むのは高いので、調子が一つだけの文書（混ざりようがない）では組まない。 */
const runsOf = (doc: ProseDocument, registers: readonly Register[]): Span[] => {
  const tree = new Set(registers).size > 1 ? doc.structure : undefined;
  if (tree === undefined) return [];
  return enumeratedRuns(
    doc.paragraphs.map((paragraph) => paragraph.span),
    itemStarts(tree),
    doc.source,
  );
};

export const sentenceEnding: Detector = (doc, options): Finding[] => {
  const polite = (options.lexicon ?? []).map((entry) => entry.pattern);
  const lists = doc.lists.map((list) => list.span);
  const found = doc.sentences.flatMap((sentence, index): { sentence: Sentence; register: Register }[] => {
    if (!isClosed(sentence) || continuesInto(sentence, doc.sentences[index + 1])) return [];
    const register = registerOfSentence(sentence, polite);
    return register === undefined ? [] : [{ sentence, register }];
  });
  const runs = runsOf(
    doc,
    found.map((entry) => entry.register),
  );
  const judged = found.map((entry): Entry => ({ ...entry, group: groupOf(entry.sentence.span.start, lists, runs) }));
  return slipsOf(judged, options.limit).map(({ entry: { sentence }, count }) => ({
    rule: "no-mixed-desumasu",
    severity: "warning",
    line: 0,
    column: 0,
    quote: sentence.text.trim(),
    values: { count, limit: options.limit, offset: sentence.span.start },
  }));
};
