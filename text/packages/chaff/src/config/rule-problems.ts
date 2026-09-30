import type { Config } from "./load.ts";
import type { RuleDefinition } from "../plugin.ts";
import type { Texts, UiLanguage } from "../ui.ts";

const TEXT: Texts<{
  readonly unknown: (where: string, id: string) => string;
  readonly unreadable: (where: string, id: string, value: string) => string;
  readonly numberOnSemantic: (where: string, id: string) => string;
  readonly numberOnSeverity: (where: string, id: string) => string;
}> = {
  ja: {
    unknown: (where, id) => `${where}: ${id} というルールはありません（npx chaff rules --json で一覧が出ます）`,
    unreadable: (where, id, value) => `${where}: ${id} の値 ${value} は読めません（strict / normal / relaxed / off か、正の数）`,
    numberOnSemantic: (where, id) =>
      `${where}: ${id} は意味を読む検査なので数値の上限はありません。normal として動きます（strict / normal / relaxed / off で書いてください）`,
    numberOnSeverity: (where, id) =>
      `${where}: ${id} には数の上限がありません。normal として動きます（段階は指摘の重さを変えます。relaxed で一段軽く、off で止まります）`,
  },
  en: {
    unknown: (where, id) => `${where}: there is no rule named ${id} (npx chaff rules --json lists them)`,
    unreadable: (where, id, value) => `${where}: cannot read ${value} as the level of ${id} (strict / normal / relaxed / off, or a positive number)`,
    numberOnSemantic: (where, id) => `${where}: ${id} reads meaning and has no numeric limit; it runs as normal (write strict / normal / relaxed / off)`,
    numberOnSeverity: (where, id) =>
      `${where}: ${id} has no numeric limit; it runs as normal (its levels set how a finding is marked: relaxed lowers it a step, off stops it)`,
  },
};

/**
 * chaff.yaml の rules のうち、効いていないもの。知らない rule 名と、読めない値。
 * どちらも黙って捨てると、書いた人は設定したつもりで何も変わっていない。打ち間違いがいちばん多い。
 */
export const ruleProblems = (
  config: Pick<Config, "rules" | "limits" | "unreadableRules" | "path">,
  known: readonly Pick<RuleDefinition, "id" | "layer" | "level_sets">[],
  ui: UiLanguage = "ja",
): string[] => {
  const text = TEXT[ui];
  const knownIds = new Set(known.map((rule) => rule.id));
  const where = config.path ?? "chaff.yaml";
  const written = [...new Set([...Object.keys(config.rules), ...Object.keys(config.limits), ...config.unreadableRules.map((entry) => entry.id)])];
  const unknown = written.filter((id) => !knownIds.has(id)).map((id) => text.unknown(where, id));
  const unreadable = config.unreadableRules.filter((entry) => knownIds.has(entry.id)).map((entry) => text.unreadable(where, entry.id, entry.value));
  // 意味を読む検査（L4）に閾値は無い。数を書いても normal として動くので、そう言う。
  const semantic = new Set(known.filter((rule) => rule.layer === "L4").map((rule) => rule.id));
  const numberOnSemantic = Object.keys(config.limits)
    .filter((id) => semantic.has(id))
    .map((id) => text.numberOnSemantic(where, id));
  const nothingToCount = new Set(known.filter((rule) => rule.layer !== "L4" && rule.level_sets === "severity").map((rule) => rule.id));
  const numberOnSeverity = Object.keys(config.limits)
    .filter((id) => nothingToCount.has(id))
    .map((id) => text.numberOnSeverity(where, id));
  return [...unknown, ...unreadable, ...numberOnSemantic, ...numberOnSeverity];
};
