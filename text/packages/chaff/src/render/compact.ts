import type { Finding, RuleDefinition } from "../plugin.ts";
import type { RunResult } from "../run.ts";
import { messageOf } from "./text.ts";
import { counted } from "./plural.ts";
import { uiLanguageOf, type Texts } from "../ui.ts";

/**
 * 最後の集計の行は、画面のほかの部分と同じく文書の言語で出す。行ごとの重さ（warning / error）は、grep や別の道具が読むので英語のまま。
 */
const TALLY: Texts<{ readonly findings: (n: number) => string; readonly notRun: (n: number) => string; readonly separator: string }> = {
  ja: { findings: (n) => `指摘 ${String(n)} 件`, notRun: (n) => `動いていない rule ${String(n)} 件`, separator: "、" },
  en: { findings: (n) => counted(n, "finding"), notRun: (n) => `${counted(n, "rule")} not run`, separator: ", " },
};

const POSITION_MIN_WIDTH = 8;
const SEVERITY_WIDTH = 8;

const positionOf = (finding: Finding): string => `${String(finding.line)}:${String(finding.column)}`;

/** 「行:桁」の列の幅。一番長い位置の後ろにも空白を 1 つ残す。grep や awk が重さの語と区切れるように。 */
export const positionWidthOf = (findings: readonly Finding[]): number =>
  findings.reduce((width, finding) => Math.max(width, positionOf(finding).length + 1), POSITION_MIN_WIDTH);

/** エンジニア向け。1 件 2 行。 */
export const renderCompact = (header: string, result: RunResult, rules: readonly RuleDefinition[], language: string): string => {
  const byId = new Map(rules.map((rule) => [rule.id, rule]));
  const width = positionWidthOf(result.findings);
  const lines = result.findings.flatMap((finding) => {
    const rule = byId.get(finding.rule);
    if (rule === undefined) return [];
    const message = `  ${positionOf(finding).padEnd(width)}${finding.severity.padEnd(SEVERITY_WIDTH)}${messageOf(rule, finding, language)}`;
    return [message, `  ${" ".repeat(width + SEVERITY_WIDTH)}${finding.rule}`];
  });
  const text = TALLY[uiLanguageOf(language)];
  const tail = [text.findings(result.findings.length), result.skipped.length > 0 ? text.notRun(result.skipped.length) : undefined].filter(
    (part) => part !== undefined,
  );
  return ["", header, "", ...lines, "", tail.join(text.separator), ""].join("\n");
};
