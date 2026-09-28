import type { RuleDefinition } from "../plugin.ts";
import type { RunResult } from "../run.ts";
import { messageOf } from "./text.ts";
import { uiLanguageOf, type Texts } from "../ui.ts";

/** 「1 finding」「2 findings」。 */
const counted = (count: number, noun: string): string => `${String(count)} ${noun}${count === 1 ? "" : "s"}`;

/**
 * 最後の集計の行は、画面のほかの部分と同じく文書の言語で出す。行ごとの重さ（warning / error）は、grep や別の道具が読むので英語のまま。
 */
const TALLY: Texts<{ readonly findings: (n: number) => string; readonly notRun: (n: number) => string; readonly separator: string }> = {
  ja: { findings: (n) => `指摘 ${String(n)} 件`, notRun: (n) => `動いていない rule ${String(n)} 件`, separator: "、" },
  en: { findings: (n) => counted(n, "finding"), notRun: (n) => `${counted(n, "rule")} not run`, separator: ", " },
};

/** エンジニア向け。1 件 2 行。 */
export const renderCompact = (header: string, result: RunResult, rules: readonly RuleDefinition[], language: string): string => {
  const byId = new Map(rules.map((rule) => [rule.id, rule]));
  const lines = result.findings.flatMap((finding) => {
    const rule = byId.get(finding.rule);
    if (rule === undefined) return [];
    const at = `${finding.line}:${finding.column}`.padEnd(8);
    return [`  ${at}${finding.severity.padEnd(8)}${messageOf(rule, finding, language)}`, `          ${" ".repeat(8)}${finding.rule}`];
  });
  const text = TALLY[uiLanguageOf(language)];
  const tail = [text.findings(result.findings.length), result.skipped.length > 0 ? text.notRun(result.skipped.length) : undefined].filter(
    (part) => part !== undefined,
  );
  return ["", header, "", ...lines, "", tail.join(text.separator), ""].join("\n");
};
