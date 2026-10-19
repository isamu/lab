/** 見出しの言葉から括弧の添え書き（「事例（約款）」の「（約款）」）を除いた、記録の型としての言葉。 */
export const recordLabelOf = (key: string): string => {
  const stem = key.replace(/[（(][^（）()]*[）)]/gu, "").trim();
  return stem === "" ? key : stem;
};

const allDistinct = (labels: readonly string[]): boolean => new Set(labels).size === labels.length;

/** start から period 個の見出しの型が、すぐ後の period 個でそのまま繰り返される。 */
const repeatsAt = (labels: readonly string[], start: number, period: number): boolean => {
  if (start < 0 || start + 2 * period > labels.length) return false;
  const first = labels.slice(start, start + period);
  const second = labels.slice(start + period, start + 2 * period);
  return allDistinct(first) && first.every((label, offset) => label === second[offset]);
};

const insideRepeat = (labels: readonly string[], index: number, period: number): boolean =>
  Array.from({ length: 2 * period }, (_, offset) => index - offset).some((start) => repeatsAt(labels, start, period));

/**
 * 兄弟の見出しの型（recordLabelOf）を並べ、index の見出しが「二つ以上の違う型の組が、同じ順で二度続く」所にある。
 * 事例ごとに【相談事例】【アドバイス】、Question / Answer をくり返す FAQ の決まった見出しで、写し忘れの重複ではない。
 */
export const insideRecordRhythm = (labels: readonly string[], index: number): boolean =>
  Array.from({ length: Math.floor(labels.length / 2) - 1 }, (_, offset) => offset + 2).some((period) => insideRepeat(labels, index, period));
