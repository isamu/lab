import type { Suppressed, Suppression } from "../stet.ts";
import type { Texts, UiLanguage } from "../ui.ts";

const TEXT: Texts<{
  readonly nudge: string;
  readonly more: (n: number) => string;
  readonly count: (n: number) => string;
  readonly reasons: (list: string) => string;
  readonly relaxAll: (rule: string) => string;
  readonly none: string;
  readonly total: (n: number) => string;
  readonly reasonless: (n: number) => string;
}> = {
  ja: {
    nudge: "  ← 設定の見直しを検討してください",
    more: (n) => ` ほか ${n} ファイル`,
    count: (n) => `${String(n).padStart(3)} 件`,
    reasons: (list) => `理由: ${list}`,
    relaxAll: (rule) => `ルールごとゆるめる: npx chaff relax ${rule} --why "..."`,
    none: "\n  抑制されている指摘はありません。\n",
    total: (n) => `抑制されている指摘: ${n} 件`,
    reasonless: (n) => `理由が書かれていない抑制: ${n} 件`,
  },
  en: {
    nudge: "  <- consider changing the setting instead",
    more: (n) => ` and ${n} more file${n === 1 ? "" : "s"}`,
    count: (n) => `${String(n).padStart(3)}`,
    reasons: (list) => `reasons: ${list}`,
    relaxAll: (rule) => `relax the whole rule: npx chaff relax ${rule} --why "..."`,
    none: "\n  No findings are silenced.\n",
    total: (n) => `Silenced findings: ${n}`,
    reasonless: (n) => `Silenced without a reason: ${n}`,
  },
};

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
    .toSorted((left, right) => right.count - left.count);
};

const groupLines = (group: Group, ui: UiLanguage): string[] => {
  const text = TEXT[ui];
  const nudge = group.count >= NUDGE_AT ? text.nudge : "";
  const shown = group.files.slice(0, 3).join(", ");
  const rest = group.files.length > 3 ? text.more(group.files.length - 3) : "";
  return [
    "",
    `  ${group.rule.padEnd(26)}${text.count(group.count)}${nudge}`,
    `      ${shown}${rest}`,
    ...(group.count >= NUDGE_AT && group.reasons.length > 0
      ? [`      ${text.reasons(group.reasons.slice(0, 2).join(" / "))}`, `      ${text.relaxAll(group.rule)}`]
      : []),
  ];
};

/**
 * 抑制が溜まったことに気づけないと、規範と現実の乖離が静かに進む。
 * 同じ rule を何度も黙らせているなら、それは (b) ではなく (c) のサイン。
 * workflow spec §7.3。
 */
export const renderSuppressions = (files: readonly PerFile[], ui: UiLanguage = "ja"): string => {
  const text = TEXT[ui];
  const groups = groupByRule(files);
  const total = groups.reduce((sum, group) => sum + group.count, 0);
  if (total === 0) return text.none;
  const reasonless = files.flatMap((file) => file.reasonless.map(() => file.path));
  return [
    "",
    `  ${text.total(total)}`,
    ...groups.flatMap((group) => groupLines(group, ui)),
    ...(reasonless.length > 0 ? ["", `  ${text.reasonless(reasonless.length)}`, `      ${[...new Set(reasonless)].join(", ")}`] : []),
    "",
  ].join("\n");
};
