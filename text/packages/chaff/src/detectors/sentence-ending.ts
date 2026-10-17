import { endingTokens, isClosed } from "../sentence-shape.ts";
import { enumeratedRuns, enumeratorStarts, numberedStarts } from "./enumerated-runs.ts";
import { continuesInto, groupOf, majorityOf, registerOf, slipsOf, type Register } from "./register.ts";
import { isRunInLabel } from "./run-in-label.ts";
import { noticeSentences } from "./notice-paragraph.ts";
import { chronologyRows } from "../chronology-rows.ts";
import type { Detector, Finding, LexiconEntry, ProseDocument, Sentence, Span } from "../plugin.ts";

/**
 * 文末の調子が混ざっているかを見る。日本語の「ですます / である」がこれ。
 *
 * どちらが正しいかは決めない。決めると、方針の違う書き手にそのまま無視される。
 * 見るのは文書の中での一貫性だけで、少数派のほうを指摘する。spec §12.3 の方針を日本語にも。
 * 終止符で終わらないもの（見出しの下の `MaaSサービス` のような名前だけの行）と、項目や段落の頭の太字の札（**速く書ける。**）は文として数えない。
 * 年表の行（1921年信号装置の製作を開始する。）も、文書の文体と揃えない書き方なので数えない。
 * 断り書きの段落（…ご了承ください。）も、本文とは別の声で書く決まり文句なので数えない（notice-paragraph.ts）。
 */
type Entry = { readonly sentence: Sentence; readonly register: Register; readonly group: number | undefined };

const registerOfSentence = (sentence: Sentence, polite: readonly LexiconEntry[], neutral: readonly LexiconEntry[]): Register | undefined => {
  const ending = endingTokens(sentence);
  const tokens = sentence.tokens ?? [];
  const head = ending[0] === undefined ? -1 : tokens.indexOf(ending[0]);
  return registerOf(ending, head > 0 ? tokens.slice(0, head) : [], polite, neutral);
};

/** 番号で始まる段落の並び。木を組むのは高いので、調子が一つだけの文書（混ざりようがない）では組まない。 */
const runsOf = (doc: ProseDocument, registers: readonly Register[]): Span[] => {
  const tree = new Set(registers).size > 1 ? doc.structure : undefined;
  if (tree === undefined) return [];
  return enumeratedRuns(
    doc.paragraphs.map((paragraph) => paragraph.span),
    enumeratorStarts(numberedStarts(tree), doc.sentences, doc.source),
    doc.source,
  );
};

/** 調子を持つ文と、比べ合うまとまり（groupOf）。polite は語彙表 polite-ending。 */
export const judgedSentences = (doc: ProseDocument, polite: readonly LexiconEntry[]): Entry[] => {
  const neutral = doc.lexicons["neutral-ending"] ?? [];
  const lists = doc.lists.map((list) => list.span);
  const rows = chronologyRows(doc);
  const all = doc.sentences.flatMap((sentence, index): { sentence: Sentence; register: Register }[] => {
    if (!isClosed(sentence) || rows.has(sentence) || continuesInto(sentence, doc.sentences[index + 1]) || isRunInLabel(doc.source, sentence.span)) return [];
    const register = registerOfSentence(sentence, polite, neutral);
    return register === undefined ? [] : [{ sentence, register }];
  });
  const registers = new Map(all.map((entry) => [entry.sentence, entry.register]));
  const majority = majorityOf(all.map((entry) => ({ register: entry.register, group: undefined })));
  const notices = noticeSentences(doc.paragraphs, doc.lexicons["notice-phrase"] ?? [], (sentence) => registers.get(sentence), majority);
  const found = all.filter((entry) => !notices.has(entry.sentence));
  const runs = runsOf(
    doc,
    found.map((entry) => entry.register),
  );
  return found.map((entry): Entry => ({ ...entry, group: groupOf(entry.sentence.span.start, lists, runs) }));
};

export const sentenceEnding: Detector = (doc, options): Finding[] => {
  const judged = judgedSentences(doc, options.lexicon ?? []);
  // 数えたのは文が属するまとまりの中なので、文言もそのまとまりを名指す（本文の中で / この箇条書きの中で）。
  return slipsOf(judged, options.limit).map(({ entry: { sentence, group }, count }) => ({
    rule: "no-mixed-desumasu",
    severity: "warning",
    line: 0,
    column: 0,
    quote: sentence.text.trim(),
    ...(group === undefined ? {} : { variant: "list" }),
    values: { count, limit: options.limit, offset: sentence.span.start },
  }));
};
