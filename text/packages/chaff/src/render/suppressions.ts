import type { Suppressed, Suppression } from "../stet.ts";

export type PerFile = { readonly path: string; readonly suppressed: readonly Suppressed[]; readonly reasonless: readonly Suppression[] };

/** これを超えたら、その rule は (b) ではなく (c) にすべきというサイン。 */
const NUDGE_AT = 5;

type Group = { readonly rule: string; readonly count: number; readonly files: readonly string[]; readonly reasons: readonly string[] };

const groupByRule = (files: readonly PerFile[]): Group[] => {
  const rows = files.flatMap((file) => file.suppressed.map((entry) => ({ path: file.path, rule: entry.finding.rule, reason: entry.suppression.reason })));
  const ids = [...new Set(rows.map((row) => row.rule))];
  return ids
    .map((rule) => {
      const mine = rows.filter((row) => row.rule === rule);
      return {
        rule,
        count: mine.length,
        files: [...new Set(mine.map((row) => row.path))],
        reasons: [...new Set(mine.flatMap((row) => (row.reason === undefined ? [] : [row.reason])))],
      };
    })
    .sort((left, right) => right.count - left.count);
};

const groupLines = (group: Group): string[] => {
  const nudge = group.count >= NUDGE_AT ? "  ← 設定の見直しを検討してください" : "";
  const shown = group.files.slice(0, 3).join(", ");
  const rest = group.files.length > 3 ? ` ほか ${group.files.length - 3} ファイル` : "";
  return [
    "",
    `  ${group.rule.padEnd(26)}${String(group.count).padStart(3)} 件${nudge}`,
    `      ${shown}${rest}`,
    ...(group.count >= NUDGE_AT && group.reasons.length > 0
      ? [`      理由: ${group.reasons.slice(0, 2).join(" / ")}`, `      ルールごとゆるめる: npx chaff relax ${group.rule} --why "..."`]
      : []),
  ];
};

/**
 * 抑制が溜まったことに気づけないと、規範と現実の乖離が静かに進む。
 * 同じ rule を何度も黙らせているなら、それは (b) ではなく (c) のサイン。
 * workflow spec §7.3。
 */
export const renderSuppressions = (files: readonly PerFile[]): string => {
  const groups = groupByRule(files);
  const total = groups.reduce((sum, group) => sum + group.count, 0);
  if (total === 0) return "\n  抑制されている指摘はありません。\n";
  const reasonless = files.flatMap((file) => file.reasonless.map(() => file.path));
  return [
    "",
    `  抑制されている指摘: ${total} 件`,
    ...groups.flatMap(groupLines),
    ...(reasonless.length > 0 ? ["", `  理由が書かれていない抑制: ${reasonless.length} 件`, `      ${[...new Set(reasonless)].join(", ")}`] : []),
    "",
  ].join("\n");
};
