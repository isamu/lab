import type { Finding, RuleDefinition } from "../plugin.ts";
import type { RunResult } from "../run.ts";
import { MARK, localized, messageOf } from "./text.ts";
import { tally } from "./summary.ts";

const RULE = 60;
const QUOTE_LIMIT = 120;

const indent = (text: string, pad: string): string[] => text.split("\n").map((line) => `${pad}${line}`);

const quoteOf = (finding: Finding): string[] => {
  const text = finding.quote.replace(/\s+/gu, " ").trim();
  if (text.length === 0) return [];
  return ["", ...indent(text.length > QUOTE_LIMIT ? `${text.slice(0, QUOTE_LIMIT)}…` : text, "    ")];
};

/**
 * 1 件につき 4 つを出す。どれが欠けても、書いた人は動けない。
 *   引用 / 何が起きているか / なぜ問題か / どう直すか
 * rule の id は「ゆるめる」コマンドの中にだけ出す。最初に読むのは name。
 */
const block = (finding: Finding, rule: RuleDefinition, language: string): string[] => [
  "",
  `─── ${finding.line} 行目 ${"─".repeat(Math.max(0, RULE - String(finding.line).length - 8))}`,
  ...quoteOf(finding),
  "",
  `  ${MARK[finding.severity] ?? "·"}  ${localized(rule.name, language)}`,
  "",
  ...indent(messageOf(rule, finding, language), "     "),
  ...indent(localized(rule.why, language), "     "),
  "",
  ...indent(`→ ${localized(rule.how_to_fix, language)}`, "     "),
  "",
  `     このルールをゆるめる:  npx chaff relax ${finding.rule}`,
  "",
];

export const renderFriendly = (header: string, result: RunResult, rules: readonly RuleDefinition[], language: string): string => {
  const byId = new Map(rules.map((rule) => [rule.id, rule]));
  const blocks = result.findings.flatMap((finding) => {
    const rule = byId.get(finding.rule);
    return rule === undefined ? [] : block(finding, rule, language);
  });
  const notes = [
    "",
    "─".repeat(RULE),
    "",
    `  ${tally(result.findings)}   すべて機械による判定です`,
    "              （同じ文章なら何度実行しても同じ結果になります）",
    "",
    "  文章は書き換えていません。直すのは書いた人です。",
  ];
  const forced =
    result.forcedExperimental.length > 0
      ? ["", `  試験中の rule を ${result.forcedExperimental.length} 件、設定により有効にしています: ${result.forcedExperimental.join(", ")}`]
      : [];
  const skipped =
    result.skipped.length > 0
      ? ["", `  ${result.skipped.length} 件の rule は動いていません:`, ...result.skipped.map((entry) => `      ${entry.rule}（${entry.why}）`)]
      : [];
  return ["", header, ...blocks, ...notes, ...forced, ...skipped, ""].join("\n");
};
