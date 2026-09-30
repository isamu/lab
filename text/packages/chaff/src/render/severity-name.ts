import type { Severity } from "../plugin.ts";
import type { Texts } from "../ui.ts";

/** A severity as the summary line names it (エラー / 注意 / 参考, error / warning / note). */
export const SEVERITY_NAME: Texts<Readonly<Record<Severity, string>>> = {
  ja: { error: "エラー", warning: "注意", info: "参考" },
  en: { error: "error", warning: "warning", info: "note" },
};

export const withArticle = (word: string): string => (/^[aeiou]/u.test(word) ? `an ${word}` : `a ${word}`);
