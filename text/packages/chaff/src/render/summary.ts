import type { Excluded } from "../files.ts";
import type { Finding } from "../plugin.ts";
import type { Texts, UiLanguage } from "../ui.ts";
import { counted } from "./plural.ts";

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
      error: (n) => counted(n, "error"),
      warning: (n) => counted(n, "warning"),
      info: (n) => counted(n, "note"),
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

/** 複数ファイルを見たときの締め。1 ファイルのときは、外したファイルの行だけ。 */
export const renderSummary = (outcomes: readonly FileOutcome[], ui: UiLanguage, excluded: Excluded = { config: 0, gitignore: 0 }): string[] => {
  const left = renderExcluded(excluded, ui);
  if (outcomes.length < 2) return left;
  const all = outcomes.flatMap((outcome) => outcome.findings);
  const touched = outcomes.filter((outcome) => outcome.findings.length > 0).length;
  return ["", "═".repeat(60), "", `  ${TEXT[ui].files(outcomes.length, touched)}`, `  ${tally(all, ui)}`, ...left, ""];
};

const EXCLUDED_TEXT: Texts<{
  readonly line: (total: number, reasons: string) => string;
  readonly join: string;
  readonly config: (n: number) => string;
  readonly ignored: (n: number) => string;
}> = {
  ja: {
    line: (total, reasons) => `検査から外したファイル: ${total} 件（${reasons}）`,
    join: "、",
    config: (n) => `chaff.yaml の exclude で ${n} 件`,
    ignored: (n) => `.gitignore で ${n} 件`,
  },
  en: {
    line: (total, reasons) => `${counted(total, "file")} not checked (${reasons})`,
    join: ", ",
    config: (n) => `${n} by exclude in chaff.yaml`,
    ignored: (n) => `${n} by .gitignore`,
  },
};

/** How many files a walk found but did not check, and why: no findings from a file left out is not "checked and fine". */
export const renderExcluded = (excluded: Excluded, ui: UiLanguage): string[] => {
  const text = EXCLUDED_TEXT[ui];
  const reasons = [...(excluded.config > 0 ? [text.config(excluded.config)] : []), ...(excluded.gitignore > 0 ? [text.ignored(excluded.gitignore)] : [])];
  return reasons.length === 0 ? [] : [`  ${text.line(excluded.config + excluded.gitignore, reasons.join(text.join))}`];
};
