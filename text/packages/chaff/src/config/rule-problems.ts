import type { Config } from "./load.ts";

/**
 * chaff.yaml の rules のうち、効いていないもの。知らない rule 名と、読めない値。
 * どちらも黙って捨てると、書いた人は設定したつもりで何も変わっていない。打ち間違いがいちばん多い。
 */
export const ruleProblems = (
  config: Pick<Config, "rules" | "limits" | "unreadableRules" | "path">,
  known: readonly { readonly id: string; readonly layer: string }[],
): string[] => {
  const knownIds = new Set(known.map((rule) => rule.id));
  const where = config.path ?? "chaff.yaml";
  const written = [...new Set([...Object.keys(config.rules), ...Object.keys(config.limits), ...config.unreadableRules.map((entry) => entry.id)])];
  const unknown = written.filter((id) => !knownIds.has(id)).map((id) => `${where}: ${id} というルールはありません（npx chaff rules --json で一覧が出ます）`);
  const unreadable = config.unreadableRules
    .filter((entry) => knownIds.has(entry.id))
    .map((entry) => `${where}: ${entry.id} の値 ${entry.value} は読めません（strict / normal / relaxed / off か、正の数）`);
  // 意味を読む検査（L4）に閾値は無い。数を書いても normal として動くので、そう言う。
  const semantic = new Set(known.filter((rule) => rule.layer === "L4").map((rule) => rule.id));
  const numberOnSemantic = Object.keys(config.limits)
    .filter((id) => semantic.has(id))
    .map((id) => `${where}: ${id} は意味を読む検査なので数値の上限はありません。normal として動きます（strict / normal / relaxed / off で書いてください）`);
  return [...unknown, ...unreadable, ...numberOnSemantic];
};
