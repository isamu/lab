type Span = { readonly start: number; readonly end: number };

/** Between two pieces of one blank: marks, spaces (\s takes in the full-width one) and a number's hyphens, on one line (〇〇区〇〇 〇丁目, 03-〇〇〇〇-〇〇〇〇). */
const JOINER = /^(?:(?!\n)[\s○〇◯△\-‐－])*$/u;
const JOINER_CHAR = /(?!\n)[\s○〇◯△\-‐－]/u;
const MARK = /[○〇◯△]/u;

/** How far the joiner characters reach from `from` in one direction, ending on a blank mark (〇〇区〇〇 takes in the last 〇〇). */
const reach = (text: string, from: number, step: 1 | -1): number => {
  const chars = step === 1 ? [...text.slice(from)] : [...text.slice(0, from)].reverse();
  const run = chars.findIndex((char) => !JOINER_CHAR.test(char));
  const within = (run === -1 ? chars : chars.slice(0, run)).map((char) => char.length);
  const lastMark = (run === -1 ? chars : chars.slice(0, run)).findLastIndex((char) => MARK.test(char));
  return from + step * within.slice(0, lastMark + 1).reduce((sum, length) => sum + length, 0);
};

/**
 * The spans as the blanks a reader sees: pieces that overlap, or that only blank marks, spaces and hyphens on one line
 * separate, are one blank, and so are the marks right beside them (〒〇〇〇-〇〇〇〇, 〇丁目〇番〇号 〇〇ビル, 東京都〇〇区〇〇).
 * A filled word between two pieces (株式会社〇〇の〇〇様) keeps them two.
 */
export const joinedBlanks = (text: string, spans: readonly Span[]): Span[] =>
  spans
    .toSorted((left, right) => left.start - right.start || left.end - right.end)
    .reduce<Span[]>((joined, span) => {
      const last = joined.at(-1);
      if (last === undefined || (span.start > last.end && !JOINER.test(text.slice(last.end, span.start)))) return [...joined, span];
      return [...joined.slice(0, -1), { start: last.start, end: Math.max(last.end, span.end) }];
    }, [])
    .map((span) => ({ start: reach(text, span.start, -1), end: reach(text, span.end, 1) }));
