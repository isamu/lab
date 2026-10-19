/** 見出しの言葉から括弧の添え書き（「事例（約款）」の「（約款）」）を除いた、記録の型としての言葉。 */
export const recordLabelOf = (key: string): string => {
  const stem = key.replace(/[（(][^（）()]*[）)]/gu, "").trim();
  return stem === "" ? key : stem;
};

/** start から period 個の型がみな違うか。窓をずらしながら数えるので、一つの period で列全体を一度なめるだけ。 */
const distinctWindows = (labels: readonly string[], period: number): boolean[] => {
  const counts = new Map<string, number>();
  const add = (label: string | undefined, by: number): void => {
    if (label !== undefined) counts.set(label, (counts.get(label) ?? 0) + by);
    if (label !== undefined && counts.get(label) === 0) counts.delete(label);
  };
  return labels.map((label, start) => {
    if (start === 0) labels.slice(0, period).forEach((first) => add(first, 1));
    else {
      add(labels[start - 1], -1);
      add(labels[start + period - 1], 1);
    }
    return start + period <= labels.length && counts.size === period;
  });
};

/** 各位置までに、period 前と同じ型だった位置の数（累積）。 */
const repeatCounts = (labels: readonly string[], period: number): number[] =>
  labels.reduce<number[]>((sums, label, at) => {
    sums.push((sums.at(-1) ?? 0) + (at >= period && labels[at - period] === label ? 1 : 0));
    return sums;
  }, []);

/** period の組が二度続く窓 [start, start + 2 * period) を、覆う範囲の印として足す。 */
const markRepeats = (labels: readonly string[], period: number, cover: number[]): void => {
  const distinct = distinctWindows(labels, period);
  const repeats = repeatCounts(labels, period);
  const repeatsIn = (from: number, to: number): number => (repeats[to - 1] ?? 0) - (repeats[from - 1] ?? 0);
  distinct.forEach((isDistinct, start) => {
    const end = start + 2 * period;
    if (!isDistinct || end > labels.length || repeatsIn(start + period, end) !== period) return;
    cover[start] = (cover[start] ?? 0) + 1;
    cover[end] = (cover[end] ?? 0) - 1;
  });
};

/**
 * 兄弟の見出しの型（recordLabelOf）の並びで、「二つ以上の違う型の組が、同じ順で二度続く」所にある見出しの印。
 * 事例ごとに【相談事例】【アドバイス】、Question / Answer をくり返す FAQ の決まった見出しで、写し忘れの重複ではない。
 * 組の長さごとに列を一度なめるので、見出しの数の二乗で済む。
 */
export const recordRhythmMask = (labels: readonly string[]): boolean[] => {
  const cover = Array.from({ length: labels.length + 1 }, () => 0);
  Array.from({ length: Math.max(0, Math.floor(labels.length / 2) - 1) }, (_, offset) => offset + 2).forEach((period) => markRepeats(labels, period, cover));
  const depths = cover.reduce<number[]>((sums, change) => {
    sums.push((sums.at(-1) ?? 0) + change);
    return sums;
  }, []);
  return labels.map((_, at) => (depths[at] ?? 0) > 0);
};
