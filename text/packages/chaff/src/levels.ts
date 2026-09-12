import type { Level, LevelTable, RuleDefinition } from "./plugin.ts";

export const LEVELS: readonly Level[] = ["strict", "normal", "relaxed", "off"];

export const isLevel = (value: unknown): value is Level => typeof value === "string" && LEVELS.some((level) => level === value);

export type Resolved = { readonly level: Level; readonly limit: number; readonly fellBackToNormal: boolean };

/**
 * 4 語を数値にする。spec §18.1。
 *
 * 意味のある段が 2 つしかない rule がある（padded-intro は strict と normal が同値）。
 * そういう rule は levels に 2 つだけ書き、未定義の段は normal に落ちる。
 * 落ちたことを呼ぶ側に伝えるのは、`chaff strict` が「変えたつもりで変わっていない」
 * 状態を作らないようにするため。
 */
/**
 * ジャンル別の閾値。"business/email" は "business" より細かいので先に当たる。
 * 仕様書の一文と社内メールに同じ文長を課すと、どちらかが必ず間違う。spec §9。
 */
const tableFor = (rule: RuleDefinition, genre: string | undefined): LevelTable => {
  if (genre === undefined) return rule.levels;
  const parts = genre.split("/");
  const keys = parts.map((_, index) => parts.slice(0, parts.length - index).join("/"));
  return keys.reduce<LevelTable | undefined>((found, key) => found ?? rule.by_genre[key], undefined) ?? rule.levels;
};

export const resolve = (rule: RuleDefinition, level: Level, genre?: string): Resolved => {
  if (level === "off") return { level, limit: 0, fellBackToNormal: false };
  const table = tableFor(rule, genre);
  const direct = table[level];
  if (direct !== undefined) return { level, limit: direct, fellBackToNormal: false };
  const normal = table.normal ?? rule.levels.normal;
  if (normal === undefined) throw new Error(`rule "${rule.id}" has no normal level`);
  return { level: "normal", limit: normal, fellBackToNormal: true };
};

/** その rule が実際に区別できる段だけを返す。CLI の案内に使う。 */
export const definedLevels = (rule: RuleDefinition): Level[] => LEVELS.filter((level) => level === "off" || rule.levels[level] !== undefined);
