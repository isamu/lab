/**
 * 語の文字を前から順に本文と照らし、それぞれの始まり（UTF-16 の位置）を返す。見つからない語は undefined。
 * kuromoji の word_position は、記号のまとまり（「)、」「**、」）や絵文字の後ろで本文とずれる。語をつなげた文字は本文と同じなので、照らせば正しい位置が出る。
 */
export const surfaceStarts = (text: string, surfaces: readonly string[]): (number | undefined)[] =>
  surfaces.reduce<{ readonly cursor: number; readonly starts: (number | undefined)[] }>(
    (acc, surface) => {
      const at = surface === "" ? -1 : text.indexOf(surface, acc.cursor);
      return at === -1 ? { cursor: acc.cursor, starts: [...acc.starts, undefined] } : { cursor: at + surface.length, starts: [...acc.starts, at] };
    },
    { cursor: 0, starts: [] },
  ).starts;
