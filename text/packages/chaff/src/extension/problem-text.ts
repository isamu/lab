import { API_VERSION } from "../api.ts";
import type { Config } from "../config/load.ts";
import type { Texts, UiLanguage } from "../ui.ts";
import { customProblemSentence } from "../custom/problems.ts";
import type { LoadProblem } from "./load.ts";
import type { PluginProblem } from "./plugin-parse.ts";

// What in the code chaff.yaml names could not be loaded, as sentences. Each names the rule or plugin and the file or
// package, as chaff.yaml writes it.

type ModuleText = Readonly<Record<LoadProblem["kind"], (rule: string, file: string, detail: string) => string>>;

type PluginText = {
  readonly problems: Readonly<Record<Exclude<PluginProblem["kind"], "rule">, (plugin: string, detail: string) => string>>;
  /** Where a plugin's rule is, for a problem a rule in custom_rules could have too. */
  readonly ruleScope: (plugin: string) => string;
};

const API = String(API_VERSION);

const MODULE_TEXT: Texts<ModuleText> = {
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

const PLUGIN_TEXT: Texts<PluginText> = {
  ja: {
    ruleScope: (plugin) => `plugins の ${plugin} の rules`,
    problems: {
      "not-a-list": (_plugin, detail) => `plugins はプラグインの並び（- chaff-plugin-foo や - ./local-plugin）で書いてください（${detail}）`,
      "bad-specifier": (plugin) =>
        `plugins の ${plugin}: パッケージは chaff-plugin-<名前> か @scope/chaff-plugin-<名前> の名前で、手元のプラグインは ./ で始まるパスで書いてください`,
      outside: (plugin) =>
        `plugins の ${plugin}: chaff.yaml のあるフォルダの外です。読み込むとそのコードが動くので、外のプラグインは絶対パスで名指ししてください`,
      "not-found": (plugin) => `plugins の ${plugin}: 見つかりません。パッケージなら chaff.yaml のあるフォルダで yarn add ${plugin} を実行してください`,
      "import-failed": (plugin, detail) => `plugins の ${plugin}: 読み込めませんでした（${detail}）`,
      "duplicate-name": (plugin, detail) => `plugins の ${plugin}: 名前 ${detail} のプラグインがもう一つあります`,
      "bad-export": (plugin, detail) =>
        `plugins の ${plugin}: default export がプラグインではありません（${detail}）。definePlugin({ name, rules }) を export default してください`,
      "no-api-version": (plugin) => `plugins の ${plugin}: 向けているプラグイン API がありません。definePlugin で作ると付きます`,
      "api-version": (plugin, detail) => `plugins の ${plugin}: プラグイン API ${detail} 向けです。この chaff のプラグイン API は ${API} です`,
      "bad-name": (plugin, detail) =>
        `plugins の ${plugin}: name: ${detail} はプラグインの名前として読めません（英小文字・数字・ハイフン。@scope/ を付けてもよい）`,
      "name-mismatch": (plugin, detail) => `plugins の ${plugin}: name は ${detail} にしてください（パッケージの名前から決まります）`,
      "no-detect": (plugin, detail) => `plugins の ${plugin}: ルール ${detail} に detect がありません`,
      "bad-lexicon": (plugin, detail) => `plugins の ${plugin}: 語彙表 ${detail} が読めません（名前: { ja: [語, …], en: [語, …] }）`,
      "bad-style": (plugin, detail) => `plugins の ${plugin}: スタイルが読めません（${detail}）`,
    },
  },
  en: {
    ruleScope: (plugin) => `plugins ${plugin} rules`,
    problems: {
      "not-a-list": (_plugin, detail) => `write plugins as a list (- chaff-plugin-foo or - ./local-plugin), not ${detail}`,
      "bad-specifier": (plugin) =>
        `plugins ${plugin}: name a package chaff-plugin-<name> or @scope/chaff-plugin-<name>, and a plugin of your own by a path starting with ./`,
      outside: (plugin) =>
        `plugins ${plugin}: it is outside the folder chaff.yaml is in. Loading a plugin runs its code, so name one outside by its absolute path`,
      "not-found": (plugin) => `plugins ${plugin}: not found. For a package, run yarn add ${plugin} in the folder chaff.yaml is in`,
      "import-failed": (plugin, detail) => `plugins ${plugin}: cannot load it (${detail})`,
      "duplicate-name": (plugin, detail) => `plugins ${plugin}: another plugin is named ${detail}`,
      "bad-export": (plugin, detail) => `plugins ${plugin}: the default export is not a plugin (${detail}); export default definePlugin({ name, rules })`,
      "no-api-version": (plugin) => `plugins ${plugin}: it does not say which plugin API it was written for; definePlugin adds that`,
      "api-version": (plugin, detail) => `plugins ${plugin}: it was written for plugin API ${detail}; this chaff has plugin API ${API}`,
      "bad-name": (plugin, detail) =>
        `plugins ${plugin}: cannot read name: ${detail} as a plugin's name (lowercase letters, digits and hyphens, with an optional @scope/)`,
      "name-mismatch": (plugin, detail) => `plugins ${plugin}: its name must be ${detail}, which the package's name gives`,
      "no-detect": (plugin, detail) => `plugins ${plugin}: the rule ${detail} has no detect`,
      "bad-lexicon": (plugin, detail) => `plugins ${plugin}: cannot read the word list ${detail} (name: { ja: [word, …], en: [word, …] })`,
      "bad-style": (plugin, detail) => `plugins ${plugin}: cannot read a style (${detail})`,
    },
  },
};

const pluginSentence = (problem: PluginProblem, ui: UiLanguage): string => {
  const text = PLUGIN_TEXT[ui];
  if (problem.kind === "rule") return customProblemSentence(problem.problem, ui, text.ruleScope(problem.plugin));
  return text.problems[problem.kind](problem.plugin, problem.detail);
};

/** What chaff.yaml names in code that could not be loaded: type: module rules, then plugins. Each stops the run. */
export const extensionProblems = (config: Pick<Config, "extensions" | "path">, ui: UiLanguage): string[] => {
  const where = `chaff: ${config.path ?? "chaff.yaml"}`;
  return [
    ...(config.extensions?.problems ?? []).map((problem) => `${where}: ${MODULE_TEXT[ui][problem.kind](problem.rule, problem.file, problem.detail)}`),
    ...(config.extensions?.pluginProblems ?? []).map((problem) => `${where}: ${pluginSentence(problem, ui)}`),
  ];
};
