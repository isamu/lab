import { adapter } from "../packages/lang-ja/src/index.ts";
import { buildDocument, teamRules } from "../packages/chaff/src/document.ts";
import { EMPTY } from "../packages/chaff/src/config/load.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { messageOf } from "../packages/chaff/src/render/text.ts";

export const STRUCTURE_RULES: readonly string[] = ["dangling-reference", "numbering-gap", "duplicate-definition"];

export type CorpusFinding = { readonly rule: string; readonly line: number; readonly message: string };

/** The structure rules' findings on one Japanese document, turned on as if --experimental. */
export const structureFindings = async (path: string, source: string): Promise<CorpusFinding[]> => {
  await adapter.prepare?.({ pos: true });
  const rules = loadRules("ja").filter((rule) => STRUCTURE_RULES.includes(rule.id));
  const result = runRules(buildDocument(path, source, adapter, teamRules(EMPTY)), rules, {}, true, "technical/spec");
  const byId = new Map(rules.map((rule) => [rule.id, rule]));
  return result.findings.flatMap((finding) => {
    const rule = byId.get(finding.rule);
    return rule === undefined ? [] : [{ rule: finding.rule, line: finding.line, message: messageOf(rule, finding, "ja") }];
  });
};
