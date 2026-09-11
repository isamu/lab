import type { Finding } from "../plugin.ts";

export type FileOutcome = { readonly path: string; readonly findings: readonly Finding[]; readonly notRun: number };

const count = (findings: readonly Finding[], severity: string): number => findings.filter((finding) => finding.severity === severity).length;

export const tally = (findings: readonly Finding[]): string => {
  const parts = [
    count(findings, "error") > 0 ? `エラー ${count(findings, "error")} 件` : undefined,
    count(findings, "warning") > 0 ? `注意 ${count(findings, "warning")} 件` : undefined,
    count(findings, "info") > 0 ? `参考 ${count(findings, "info")} 件` : undefined,
  ].filter((part) => part !== undefined);
  return parts.length === 0 ? "指摘はありません" : parts.join("、");
};

/** 複数ファイルを見たときの締め。1 ファイルのときは出さない。 */
export const renderSummary = (outcomes: readonly FileOutcome[]): string[] => {
  if (outcomes.length < 2) return [];
  const all = outcomes.flatMap((outcome) => outcome.findings);
  const touched = outcomes.filter((outcome) => outcome.findings.length > 0).length;
  return ["", "═".repeat(60), "", `  ${outcomes.length} ファイルを見て、${touched} ファイルに指摘がありました`, `  ${tally(all)}`, ""];
};
