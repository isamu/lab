/** 1 行。text は改行を含まず、\r\n の \r も落としてある。start は元の文書での位置。 */
export type Line = { readonly text: string; readonly start: number; readonly number: number };

/**
 * 行に分ける。位置は元の文字列のまま数える。
 * Windows で書かれた契約書は \r\n で届くので、\r を本文に残すと行末の判定がずれる。
 * 行ごとに配列を作り直さない。何万行もある契約書で二乗に遅くなるため。
 */
export const linesOf = (source: string): Line[] => {
  const lines: Line[] = [];
  let at = 0;
  source.split("\n").forEach((raw, index) => {
    lines.push({ text: raw.endsWith("\r") ? raw.slice(0, -1) : raw, start: at, number: index + 1 });
    at += raw.length + 1;
  });
  return lines;
};

/** offset を含む行の番号（1 始まり）。lines は start の昇順。二分探索で、行数に対して対数で引く。 */
export const lineNumberAt = (lines: readonly Line[], offset: number): number | undefined => {
  let low = 0;
  let high = lines.length - 1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    const line = lines[middle];
    if (line === undefined) return undefined;
    if (offset < line.start) high = middle - 1;
    else if (offset > line.start + line.text.length) low = middle + 1;
    else return line.number;
  }
  return undefined;
};
