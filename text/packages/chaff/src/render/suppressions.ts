import type { StetProblem, Suppressed, Suppression } from "../stet.ts";
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
  readonly ranges: string;
  readonly noReason: string;
  readonly problems: (n: number) => string;
  readonly problem: Readonly<Record<StetProblem["kind"], (rule: string) => string>>;
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
    ranges: "範囲の stet（stet-begin … stet-end）:",
    noReason: "（理由なし）",
    problems: (n) => `効いていない、または書き方に問題のある stet: ${n} 件`,
    problem: {
      unclosed: () => "stet-begin に対応する stet-end がありません。何も黙らせていません",
      "stray-end": () => "対応する stet-begin の無い stet-end です",
      "no-rules": () => "ルール名がありません。黙らせるルールを書いてください（全ルールをまとめて黙らせる書き方はありません）",
      "unknown-rule": (rule) => `「${rule}」というルールはありません`,
      "no-matched-text": (rule) => `${rule} の指摘は見つけた語句を持たないので、rule["語句"] では黙りません`,
    },
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
    ranges: "Range stets (stet-begin … stet-end):",
    noReason: "(no reason)",
    problems: (n) => `Stets that do not work or are written wrong: ${n}`,
    problem: {
      unclosed: () => "stet-begin has no stet-end; it silences nothing",
      "stray-end": () => "stet-end with no stet-begin to close",
      "no-rules": () => "names no rule; write the rules to silence (there is no all-rules form)",
      "unknown-rule": (rule) => `there is no rule named "${rule}"`,
      "no-matched-text": (rule) => `${rule} findings carry no matched text, so rule["text"] silences none of them`,
    },
  },
};

export type PerFile = {
  readonly path: string;
  readonly suppressed: readonly Suppressed[];
  readonly reasonless: readonly Suppression[];
  /** Rules a stet in the file names that did not run, so their silenced findings could not be counted. */
  readonly notRun: readonly NotRun[];
  readonly ranges: readonly Suppression[];
  readonly problems: readonly StetProblem[];
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

/** Every range stet, with its lines, the rules it names and why, so a long silenced stretch is seen. */
const rangeLines = (files: readonly PerFile[], ui: UiLanguage): string[] => {
  const text = TEXT[ui];
  const rows = files.flatMap((file) =>
    file.ranges.map((range) => `      ${file.path}:${range.line}-${range.blockEnd}   ${range.rules.join(", ")}   ${range.reason ?? text.noReason}`),
  );
  return rows.length === 0 ? [] : ["", `  ${text.ranges}`, ...rows];
};

const problemLines = (files: readonly PerFile[], ui: UiLanguage): string[] => {
  const text = TEXT[ui];
  const rows = files.flatMap((file) =>
    file.problems.map((problem) => `      ${file.path}:${problem.line}   ${text.problem[problem.kind](problem.rule ?? "")}`),
  );
  return rows.length === 0 ? [] : ["", `  ${text.problems(rows.length)}`, ...rows];
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
  const trailing = [...notRunLines(files, ui), ...rangeLines(files, ui), ...problemLines(files, ui)];
  if (total === 0) return trailing.length === 0 ? text.none : [text.none.trimEnd(), ...trailing, ""].join("\n");
  const reasonless = files.flatMap((file) => file.reasonless.map(() => file.path));
  return [
    "",
    `  ${text.total(total)}`,
    ...groups.flatMap((group) => groupLines(group, ui)),
    ...(reasonless.length > 0 ? ["", `  ${text.reasonless(reasonless.length)}`, `      ${[...new Set(reasonless)].join(", ")}`] : []),
    ...trailing,
    "",
  ].join("\n");
};
