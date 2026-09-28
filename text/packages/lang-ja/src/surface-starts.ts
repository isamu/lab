/**
 * 語の文字を前から順に本文と照らし、それぞれの始まり（UTF-16 の位置）を返す。見つからない語は undefined。
 * kuromoji の word_position は、記号のまとまり（「)、」「**、」）や絵文字の後ろで本文とずれる。語をつなげた文字は本文と同じなので、照らせば正しい位置が出る。
 */
export const surfaceStarts = (text: string, surfaces: readonly string[]): (number | undefined)[] => {
  const scan = { cursor: 0 };
  return surfaces.map((surface) => {
    const at = surface === "" ? -1 : text.indexOf(surface, scan.cursor);
    if (at === -1) return undefined;
    scan.cursor = at + surface.length;
    return at;
  });
};
