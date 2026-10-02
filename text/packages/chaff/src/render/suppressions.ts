import type { Suppressed, Suppression } from "../stet.ts";
import type { NotRun } from "../not-run.ts";
import type { Texts, UiLanguage } from "../ui.ts";
import { counted } from "./plural.ts";

const TEXT: Texts<{
  readonly nudge: string;
  readonly more: (n: number) => string;
  readonly count: (n: number) => string;
  readonly reasons: (list: string) => string;
  readonly relaxAll: (rule: string) => string;
  readonly none: string;
  readonly total: (n: number) => string;
  readonly reasonless: (n: number) => string;
  readonly notRun: string;
  readonly runExperimental: string;
}> = {
  ja: {
    nudge: "  ← 設定の見直しを検討してください",
    more: (n) => ` ほか ${n} ファイル`,
    count: (n) => `${String(n).padStart(3)} 件`,
    reasons: (list) => `理由: ${list}`,
    relaxAll: (rule) => `ルールごとゆるめる: npx chaffjs relax ${rule} --why "..."`,
    none: "\n  抑制されている指摘はありません。\n",
    total: (n) => `抑制されている指摘: ${n} 件`,
    reasonless: (n) => `理由が書かれていない抑制: ${n} 件`,
    notRun: "stet はあるが、今回動いていない rule（数えていません）:",
    runExperimental: "試験中の rule は --experimental を付けると数えます。",
  },
  en: {
    nudge: "  <- consider changing the setting instead",
    more: (n) => ` and ${counted(n, "more file")}`,
    count: (n) => `${String(n).padStart(3)}`,
    reasons: (list) => `reasons: ${list}`,
    relaxAll: (rule) => `relax the whole rule: npx chaffjs relax ${rule} --why "..."`,
    none: "\n  No findings are silenced.\n",
    total: (n) => `Silenced findings: ${n}`,
    reasonless: (n) => `Silenced without a reason: ${n}`,
    notRun: "Rules with a stet that did not run in this check (not counted):",
    runExperimental: "Experimental rules are counted with --experimental.",
  },
};

export type PerFile = {
  readonly path: string;
  readonly suppressed: readonly Suppressed[];
  readonly reasonless: readonly Suppression[];
  /** Rules a stet in the file names that did not run, so their silenced findings could not be counted. */
  readonly notRun: readonly NotRun[];
};

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

/** The rules whose stets were not counted because the rule did not run, one line each, with why and where. */
const notRunLines = (files: readonly PerFile[], ui: UiLanguage): string[] => {
  const text = TEXT[ui];
  const rows = files.flatMap((file) => file.notRun.map((entry) => ({ ...entry, path: file.path })));
  if (rows.length === 0) return [];
  const rules = [...new Set(rows.map((row) => row.rule))];
  const lines = rules.map((rule) => {
    const mine = rows.filter((row) => row.rule === rule);
    return `      ${rule.padEnd(26)}${mine[0]?.why ?? ""}   ${[...new Set(mine.map((row) => row.path))].join(", ")}`;
  });
  return ["", `  ${text.notRun}`, ...lines, ...(rows.some((row) => row.needsExperimental) ? [`  ${text.runExperimental}`] : [])];
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
  const notRun = notRunLines(files, ui);
  if (total === 0) return notRun.length === 0 ? text.none : [text.none.trimEnd(), ...notRun, ""].join("\n");
  const reasonless = files.flatMap((file) => file.reasonless.map(() => file.path));
  return [
    "",
    `  ${text.total(total)}`,
    ...groups.flatMap((group) => groupLines(group, ui)),
    ...(reasonless.length > 0 ? ["", `  ${text.reasonless(reasonless.length)}`, `      ${[...new Set(reasonless)].join(", ")}`] : []),
    ...notRun,
    "",
  ].join("\n");
};
