/** kuromoji が自分で文を区切る記号。区切りの間が長いほど、その長さの二乗で時間がかかる。 */
const STOPS: ReadonlySet<string> = new Set(["、", "。"]);

const WHITESPACE = /\s/u;

/** 絵文字のようなサロゲートの対を割らない。 */
const keepPair = (text: string, at: number): number => {
  const low = text.charCodeAt(at);
  const high = text.charCodeAt(at - 1);
  return low >= 0xdc00 && low <= 0xdfff && high >= 0xd800 && high <= 0xdbff ? at - 1 : at;
};

const slices = (text: string, cuts: readonly number[]): string[] => [0, ...cuts].map((start, index) => text.slice(start, cuts[index] ?? text.length));

/**
 * 解析器に渡すかたまり。句読点の無いまま limit 文字を超える所だけを切り、それ以外は本文を 1 つのまま返す。
 * 切るのは、その範囲の最後の空白の後ろ。空白が無ければ limit 文字目。
 */
export const analyserPieces = (text: string, limit: number): string[] => {
  const cuts: number[] = [];
  const stretch = { start: 0, afterSpace: -1 };
  for (let at = 0; at < text.length; at += 1) {
    const char = text[at] ?? "";
    if (STOPS.has(char)) {
      stretch.start = at + 1;
      stretch.afterSpace = -1;
    } else {
      if (at + 1 - stretch.start > limit) {
        const cut = stretch.afterSpace > stretch.start ? stretch.afterSpace : keepPair(text, at);
        cuts.push(cut);
        stretch.start = cut;
        stretch.afterSpace = -1;
      }
      if (WHITESPACE.test(char)) stretch.afterSpace = at + 1;
    }
  }
  return slices(text, cuts);
};
