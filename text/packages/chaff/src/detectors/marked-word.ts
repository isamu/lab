import type { Detector, Finding, Sentence, Span, Token } from "../plugin.ts";
import { QUOTATION_MARKS, isWithinAny, quotedSpans } from "../quoted-span.ts";

// 言語アダプタが語に付けた印（ら抜き・さ入れ）を、文の中の言葉として指す rule の形。

/** 印の付いた語が続く並び（「食べ」「れる」）を一つにまとめた、文書の中の範囲。 */
const markedRuns = (tokens: readonly Token[], isMarked: (token: Token) => boolean): Span[] =>
  tokens.reduce<Span[]>((runs, token, index) => {
    if (!isMarked(token)) return runs;
    const last = runs.at(-1);
    const previous = tokens[index - 1];
    if (last !== undefined && previous !== undefined && isMarked(previous)) return [...runs.slice(0, -1), { start: last.start, end: token.span.end }];
    return [...runs, token.span];
  }, []);

export type MarkedWord = { readonly written: string; readonly offset: number };

/** 文の中の印の付いた言葉。鉤括弧や引用符で引いた言葉（話した言葉をそのまま引いたもの）は数えない。 */
export const markedWordsIn = (sentence: Sentence, isMarked: (token: Token) => boolean): MarkedWord[] => {
  const quoted = quotedSpans(sentence.text, QUOTATION_MARKS);
  return markedRuns(sentence.tokens ?? [], isMarked)
    .map((run) => ({ start: run.start - sentence.span.start, end: run.end - sentence.span.start }))
    .filter((run) => !isWithinAny(quoted, run))
    .map((run) => ({ written: sentence.text.slice(run.start, run.end), offset: sentence.span.start + run.start }));
};

/** 印の付いた言葉を一つずつ指す detector。指摘の matched に書いたままの言葉を入れる。 */
export const markedWordDetector =
  (isMarked: (token: Token) => boolean): Detector =>
  (doc): Finding[] =>
    doc.sentences.flatMap((sentence) =>
      markedWordsIn(sentence, isMarked).map((word) => ({
        rule: "",
        severity: "warning",
        line: 0,
        column: 0,
        quote: sentence.text.trim(),
        values: { matched: word.written, offset: word.offset },
      })),
    );
