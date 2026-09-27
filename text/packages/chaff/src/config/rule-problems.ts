import type { Config } from "./load.ts";

/**
 * chaff.yaml の rules のうち、効いていないもの。知らない rule 名と、読めない値。
 * どちらも黙って捨てると、書いた人は設定したつもりで何も変わっていない。打ち間違いがいちばん多い。
 */
export const ruleProblems = (config: Pick<Config, "rules" | "limits" | "unreadableRules" | "path">, knownIds: readonly string[]): string[] => {
  const known = new Set(knownIds);
  const where = config.path ?? "chaff.yaml";
  const written = [...new Set([...Object.keys(config.rules), ...Object.keys(config.limits), ...config.unreadableRules.map((entry) => entry.id)])];
  const unknown = written.filter((id) => !known.has(id)).map((id) => `${where}: ${id} というルールはありません（npx chaff rules --json で一覧が出ます）`);
  const unreadable = config.unreadableRules
    .filter((entry) => known.has(entry.id))
    .map((entry) => `${where}: ${entry.id} の値 ${entry.value} は読めません（strict / normal / relaxed / off か、正の数）`);
  return [...unknown, ...unreadable];
};
