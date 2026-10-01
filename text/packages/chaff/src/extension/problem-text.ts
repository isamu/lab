import { API_VERSION } from "../api.ts";
import type { Config } from "../config/load.ts";
import type { Texts, UiLanguage } from "../ui.ts";
import type { LoadProblem } from "./load.ts";

// What in the code chaff.yaml names could not be loaded, as sentences. Each names the rule and the file.

type Text = Readonly<Record<LoadProblem["kind"], (rule: string, file: string, detail: string) => string>>;

const API = String(API_VERSION);

const TEXT: Texts<Text> = {
  ja: {
    "missing-file": (rule, file) => `custom_rules の ${rule}: module のファイル ${file} がありません`,
    outside: (rule, file) =>
      `custom_rules の ${rule}: ${file} はリンクをたどると chaff.yaml のあるフォルダの外です。読み込むとそのコードが動くので、外のファイルは絶対パスで名指ししてください`,
    "import-failed": (rule, file, detail) => `custom_rules の ${rule}: ${file} を読み込めませんでした（${detail}）`,
    "bad-export": (rule, file, detail) =>
      `custom_rules の ${rule}: ${file} の default export が検出器ではありません（${detail}）。関数か defineRule({ detect }) を export default してください`,
    "api-version": (rule, file, detail) => `custom_rules の ${rule}: ${file} はプラグイン API ${detail} 向けです。この chaff のプラグイン API は ${API} です`,
  },
  en: {
    "missing-file": (rule, file) => `custom_rules ${rule}: the module file ${file} does not exist`,
    outside: (rule, file) =>
      `custom_rules ${rule}: ${file} leads outside the folder chaff.yaml is in through a link. Loading a module runs its code, so name a file outside by its absolute path`,
    "import-failed": (rule, file, detail) => `custom_rules ${rule}: cannot load ${file} (${detail})`,
    "bad-export": (rule, file, detail) =>
      `custom_rules ${rule}: the default export of ${file} is not a detector (${detail}); export default a function or defineRule({ detect })`,
    "api-version": (rule, file, detail) => `custom_rules ${rule}: ${file} was written for plugin API ${detail}; this chaff has plugin API ${API}`,
  },
};

/** What chaff.yaml names that could not be loaded. Each stops the run. */
export const extensionProblems = (config: Pick<Config, "extensions" | "path">, ui: UiLanguage): string[] =>
  (config.extensions?.problems ?? []).map(
    (problem) => `chaff: ${config.path ?? "chaff.yaml"}: ${TEXT[ui][problem.kind](problem.rule, problem.file, problem.detail)}`,
  );
