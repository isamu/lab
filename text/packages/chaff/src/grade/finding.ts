import type { SourceCheck } from "../check-source.ts";
import type { Finding } from "../plugin.ts";
import { messageOf } from "../render/text.ts";
import type { GradeFinding } from "./result.ts";

/** One finding as `chaff grade` writes it: the rule, the level, where, and the message the command line prints. */
export const findingOf = (finding: Finding, check: SourceCheck): GradeFinding => {
  const rule = check.rules.find((entry) => entry.id === finding.rule);
  return {
    rule: finding.rule,
    level: finding.severity,
    line: finding.line,
    column: finding.column,
    message: rule === undefined ? finding.rule : messageOf(rule, finding, check.language),
  };
};
