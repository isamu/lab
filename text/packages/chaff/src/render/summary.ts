import type { Finding } from "../plugin.ts";
import type { Texts, UiLanguage } from "../ui.ts";

export type FileOutcome = { readonly path: string; readonly findings: readonly Finding[]; readonly notRun: number };

const count = (findings: readonly Finding[], severity: string): number => findings.filter((finding) => finding.severity === severity).length;

type Severity = "error" | "warning" | "info";

const TEXT: Texts<{
  readonly counts: Readonly<Record<Severity, (n: number) => string>>;
  readonly join: string;
  readonly none: string;
  readonly files: (seen: number, touched: number) => string;
}> = {
  ja: {
    counts: { error: (n) => `エラー ${n} 件`, warning: (n) => `注意 ${n} 件`, info: (n) => `参考 ${n} 件` },
    join: "、",
    none: "指摘はありません",
    files: (seen, touched) => `${seen} ファイルを見て、${touched} ファイルに指摘がありました`,
  },
  en: {
    counts: {
      error: (n) => `${n} error${n === 1 ? "" : "s"}`,
      warning: (n) => `${n} warning${n === 1 ? "" : "s"}`,
      info: (n) => `${n} note${n === 1 ? "" : "s"}`,
    },
    join: ", ",
    none: "No findings",
    files: (seen, touched) => `${seen} files checked, ${touched} with findings`,
  },
};

const SEVERITIES: readonly Severity[] = ["error", "warning", "info"];

export const tally = (findings: readonly Finding[], ui: UiLanguage): string => {
  const parts = SEVERITIES.filter((severity) => count(findings, severity) > 0).map((severity) => TEXT[ui].counts[severity](count(findings, severity)));
  return parts.length === 0 ? TEXT[ui].none : parts.join(TEXT[ui].join);
};

/** 複数ファイルを見たときの締め。1 ファイルのときは出さない。 */
export const renderSummary = (outcomes: readonly FileOutcome[], ui: UiLanguage): string[] => {
  if (outcomes.length < 2) return [];
  const all = outcomes.flatMap((outcome) => outcome.findings);
  const touched = outcomes.filter((outcome) => outcome.findings.length > 0).length;
  return ["", "═".repeat(60), "", `  ${TEXT[ui].files(outcomes.length, touched)}`, `  ${tally(all, ui)}`, ""];
};
