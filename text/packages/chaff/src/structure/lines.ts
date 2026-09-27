/** 1 行。text は改行を含まず、\r\n の \r も落としてある。start は元の文書での位置。 */
export type Line = { readonly text: string; readonly start: number; readonly number: number };

/**
 * 行に分ける。位置は元の文字列のまま数える。
 * Windows で書かれた契約書は \r\n で届くので、\r を本文に残すと行末の判定がずれる。
 */
export const linesOf = (source: string): Line[] =>
  source.split("\n").reduce<{ readonly lines: Line[]; readonly at: number }>(
    ({ lines, at }, raw, index) => ({
      lines: [...lines, { text: raw.endsWith("\r") ? raw.slice(0, -1) : raw, start: at, number: index + 1 }],
      at: at + raw.length + 1,
    }),
    { lines: [], at: 0 },
  ).lines;
