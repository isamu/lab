import type { Detector, Finding, Sentence, Span, Token } from "../plugin.ts";
import { QUOTATION_MARKS, isWithinAny, quotedSpans } from "../quoted-span.ts";

/** 言語アダプタが、ら抜き言葉の一部の語に付ける印（lang-ja の PotentialRa=Dropped）。 */
const isRaDropped = (token: Token): boolean => token.features?.["PotentialRa"] === "Dropped";

/** 印の付いた語が続く並び（「食べ」「れる」）を一つにまとめた、文書の中の範囲。 */
const markedRuns = (tokens: readonly Token[]): Span[] =>
  tokens.reduce<Span[]>((runs, token, index) => {
    if (!isRaDropped(token)) return runs;
    const last = runs.at(-1);
    const previous = tokens[index - 1];
    if (last !== undefined && previous !== undefined && isRaDropped(previous)) return [...runs.slice(0, -1), { start: last.start, end: token.span.end }];
    return [...runs, token.span];
  }, []);

export type RaDroppedWord = { readonly written: string; readonly offset: number };

/** 文の中のら抜き言葉。鉤括弧や引用符で引いた言葉（話した言葉をそのまま引いたもの）は数えない。 */
export const raDroppedIn = (sentence: Sentence): RaDroppedWord[] => {
  const quoted = quotedSpans(sentence.text, QUOTATION_MARKS);
  return markedRuns(sentence.tokens ?? [])
    .map((run) => ({ start: run.start - sentence.span.start, end: run.end - sentence.span.start }))
    .filter((run) => !isWithinAny(quoted, run))
    .map((run) => ({ written: sentence.text.slice(run.start, run.end), offset: sentence.span.start + run.start }));
};

export const raNuki: Detector = (doc): Finding[] =>
  doc.sentences.flatMap((sentence) =>
    raDroppedIn(sentence).map((word) => ({
      rule: "",
      severity: "warning",
      line: 0,
      column: 0,
      quote: sentence.text.trim(),
      values: { matched: word.written, offset: word.offset },
    })),
  );
