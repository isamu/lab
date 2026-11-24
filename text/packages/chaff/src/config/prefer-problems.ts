import type { Config } from "./load.ts";
import type { Texts, UiLanguage } from "../ui.ts";
import type { PreferProblem } from "./prefer.ts";
import { scopeProblemSentence } from "../scope-problem-text.ts";

const TEXT: Texts<{ readonly at: (where: string, avoid: string) => string; readonly noUse: string }> = {
  ja: {
    at: (where, avoid) => `${where}: prefer の ${avoid}: `,
    noUse: "使う書き方を use に書いてください（例: { use: 当社, scope: [~quote] }）",
  },
  en: {
    at: (where, avoid) => `${where}: prefer ${avoid}: `,
    noUse: "write the spelling to use under use (for example { use: our company, scope: [~quote] })",
  },
};

const detailOf = (problem: PreferProblem, ui: UiLanguage): string =>
  problem.kind === "no-use" ? TEXT[ui].noUse : scopeProblemSentence(problem.scope.kind, problem.scope.written, ui);

/** prefer's entries that cannot be used. Each stops the run: an entry that silently does not count looks like a clean document. */
export const preferProblems = (config: Pick<Config, "unreadablePrefer" | "path">, ui: UiLanguage): string[] =>
  (config.unreadablePrefer ?? []).map((problem) => `chaff: ${TEXT[ui].at(config.path ?? "chaff.yaml", problem.avoid)}${detailOf(problem, ui)}`);
