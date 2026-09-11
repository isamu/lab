import type { RuleDefinition } from "../plugin.ts";
import type { RunResult } from "../run.ts";
import { messageOf } from "./text.ts";

/** エンジニア向け。1 件 2 行。 */
export const renderCompact = (header: string, result: RunResult, rules: readonly RuleDefinition[], language: string): string => {
  const byId = new Map(rules.map((rule) => [rule.id, rule]));
  const lines = result.findings.flatMap((finding) => {
    const rule = byId.get(finding.rule);
    if (rule === undefined) return [];
    const at = `${finding.line}:${finding.column}`.padEnd(8);
    return [`  ${at}${finding.severity.padEnd(8)}${messageOf(rule, finding, language)}`, `          ${" ".repeat(8)}${finding.rule}`];
  });
  const tail = [`${result.findings.length} findings`, result.skipped.length > 0 ? `${result.skipped.length} rules not run` : undefined].filter(
    (part) => part !== undefined,
  );
  return ["", header, "", ...lines, "", tail.join(", "), ""].join("\n");
};
