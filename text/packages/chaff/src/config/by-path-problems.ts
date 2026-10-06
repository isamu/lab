import type { Config } from "./load.ts";
import type { Texts, UiLanguage } from "../ui.ts";

const TEXT: Texts<{ readonly unreadable: (where: string, value: string) => string }> = {
  ja: {
    unreadable: (where, value) =>
      `${where}: by_path の ${value} は読めないので使いません。by_path は files と、genre・language・profile の組を並べます（- files: ["guides/**/*.md"] と genre: docs/manual）`,
  },
  en: {
    unreadable: (where, value) =>
      `${where}: cannot read ${value} under by_path, so it is not used. by_path is a list of files with genre, language or profile (- files: ["guides/**/*.md"] with genre: docs/manual)`,
  },
};

/** chaff.yaml の by_path のうち、読めなかったもの。 */
export const byPathProblems = (config: Pick<Config, "unreadableByPath" | "path">, ui: UiLanguage = "ja"): string[] =>
  (config.unreadableByPath ?? []).map((value) => TEXT[ui].unreadable(config.path ?? "chaff.yaml", value));
