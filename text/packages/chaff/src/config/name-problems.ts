import type { Config } from "./load.ts";
import type { Texts, UiLanguage } from "../ui.ts";

const TEXT: Texts<{ readonly unreadable: (where: string, value: string) => string }> = {
  ja: {
    unreadable: (where, value) => `${where}: names の ${value} は名前として読めません。names には名前を 1 行に 1 つずつ並べてください（- 個人情報保護委員会）`,
  },
  en: {
    unreadable: (where, value) => `${where}: cannot read ${value} under names as a name. Write names as a list, one name per line (- Bank of England)`,
  },
};

/** chaff.yaml の names のうち、名前として読めなかったもの。読めないまま黙ると、書いた人は名前を並べたつもりで何も変わっていない。 */
export const nameProblems = (config: Pick<Config, "unreadableNames" | "path">, ui: UiLanguage = "ja"): string[] =>
  config.unreadableNames.map((value) => TEXT[ui].unreadable(config.path ?? "chaff.yaml", value));
