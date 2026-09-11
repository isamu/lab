import type { Level, RuleDefinition } from "./plugin.ts";

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
export const resolve = (rule: RuleDefinition, level: Level): Resolved => {
  if (level === "off") return { level, limit: 0, fellBackToNormal: false };
  const direct = rule.levels[level];
  if (direct !== undefined) return { level, limit: direct, fellBackToNormal: false };
  const normal = rule.levels.normal;
  if (normal === undefined) throw new Error(`rule "${rule.id}" has no normal level`);
  return { level: "normal", limit: normal, fellBackToNormal: true };
};

/** その rule が実際に区別できる段だけを返す。CLI の案内に使う。 */
export const definedLevels = (rule: RuleDefinition): Level[] => LEVELS.filter((level) => level === "off" || rule.levels[level] !== undefined);
