import type { RuleDefinition } from "../plugin.ts";
import type { RunResult } from "../run.ts";
import { messageOf } from "./text.ts";

/** 「1 finding」「2 findings」。 */
const counted = (count: number, noun: string): string => `${String(count)} ${noun}${count === 1 ? "" : "s"}`;

/** エンジニア向け。1 件 2 行。 */
export const renderCompact = (header: string, result: RunResult, rules: readonly RuleDefinition[], language: string): string => {
  const byId = new Map(rules.map((rule) => [rule.id, rule]));
  const lines = result.findings.flatMap((finding) => {
    const rule = byId.get(finding.rule);
    if (rule === undefined) return [];
    const at = `${finding.line}:${finding.column}`.padEnd(8);
    return [`  ${at}${finding.severity.padEnd(8)}${messageOf(rule, finding, language)}`, `          ${" ".repeat(8)}${finding.rule}`];
  });
  const tail = [counted(result.findings.length, "finding"), result.skipped.length > 0 ? `${counted(result.skipped.length, "rule")} not run` : undefined].filter(
    (part) => part !== undefined,
  );
  return ["", header, "", ...lines, "", tail.join(", "), ""].join("\n");
};
