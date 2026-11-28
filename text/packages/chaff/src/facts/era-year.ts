/** 元号のすぐ後ろ（空白一つまで）の数。暦の年（平成29年、令和 3 年）で、年数という長さではない。元号は語彙表 calendar-era から。 */
const ERA_GAP = /[ \t\u3000]?$/u;

export const followsEra = (source: string, start: number, eras: readonly string[]): boolean => {
  const head = source.slice(0, start).replace(ERA_GAP, "");
  return eras.some((era) => era !== "" && head.endsWith(era));
};
