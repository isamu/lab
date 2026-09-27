/** Lines around a line of a document, 1-based and inclusive. Only these lines go into a report. */
export type Excerpt = { readonly from: number; readonly to: number; readonly lines: readonly string[] };

export const EXCERPT_RADIUS = 2;

/** Pure: the excerpts around each line, overlapping ones merged, in document order. Lines outside the document are dropped. */
export const excerptsAround = (source: string, lines: readonly number[], radius: number = EXCERPT_RADIUS): Excerpt[] => {
  const all = source.split("\n");
  const ranges = [...new Set(lines)]
    .filter((line) => line >= 1 && line <= all.length)
    .sort((left, right) => left - right)
    .map((line) => ({ from: Math.max(1, line - radius), to: Math.min(all.length, line + radius) }));
  const merged = ranges.reduce<{ from: number; to: number }[]>((acc, range) => {
    const last = acc.at(-1);
    if (last !== undefined && range.from <= last.to + 1) {
      last.to = Math.max(last.to, range.to);
      return acc;
    }
    acc.push({ ...range });
    return acc;
  }, []);
  return merged.map(({ from, to }) => ({ from, to, lines: all.slice(from - 1, to) }));
};
