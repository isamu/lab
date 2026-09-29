/**
 * 空白の無いまま limit 文字を超える並びを、同じ長さの空白で覆う。語ではなく（base64、ハッシュ、区切りの無い記号の列）、
 * 解析器（wink）はその長さの二乗で遅くなる。長さを変えないので、残りの語の位置はそのまま。
 */
export const blankLongRuns = (text: string, limit: number): string =>
  text.replace(new RegExp(`\\S{${String(limit + 1)},}`, "gu"), (run) => " ".repeat(run.length));
