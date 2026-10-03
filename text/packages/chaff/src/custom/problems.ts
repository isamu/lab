import type { Config } from "../config/load.ts";
import type { Texts, UiLanguage } from "../ui.ts";
import type { CustomProblem } from "./parse.ts";
import { customRulesOf } from "./load.ts";
import { MAX_PATTERN_LENGTH, MAX_REPEATS, type RegexRefusal } from "./regex-safety.ts";
import { POS_WRITTEN_NAMES } from "./token-pattern.ts";
import type { ModulePathRefusal } from "./module-path.ts";
import { unknownDepthSentence } from "../rewrite-depth.ts";

/** Each problem's sentence, with {at}, {written}, {field}, {index}, {refusal} and {names} filled in from the problem. */
type Text = {
  readonly problems: Readonly<Record<CustomProblem["kind"], string>>;
  readonly refusal: Readonly<Record<RegexRefusal, string>>;
  readonly modulePath: Readonly<Record<ModulePathRefusal, string>>;
};

const TEXT: Texts<Text> = {
  ja: {
    modulePath: {
      outside: "chaff.yaml のあるフォルダの外です。読み込むとそのコードが動くので、外のファイルは絶対パスで名指ししてください",
    },
    refusal: {
      "too-long": `${String(MAX_PATTERN_LENGTH)} 字を超えています。いくつかのルールに分けてください`,
      "nested-quantifier": "繰り返しの中に繰り返しがあります（(a+)+ のような形）。長い行で止まらなくなるので使えません",
      "too-many-repeats": `回数の決まらない繰り返し（* や + や {1,9}）が ${String(MAX_REPEATS)} つを超えています。長い行で止まらなくなることがあります`,
      backreference: "後方参照（\\1）は使えません。長い行で止まらなくなることがあるためです",
      "empty-match": "何も無い所にも当たります。すべての文で指摘が出てしまいます",
      invalid: "正規表現として読めません",
    },
    problems: {
      "not-a-list": "{scope} はルールの並び（- id: …）で書いてください",
      "not-a-map": "{scope} の {at}: id や type を持つ項目として書いてください",
      "bad-id": "{scope} の {at}: id は英小文字で始まり、英小文字・数字・ハイフンだけで書きます（例: team-no-tbd）",
      "duplicate-id": "{scope} の {at}: 同じ id のルールがもう一つあります",
      "built-in-id": "{scope} の {at}: chaff のルールと同じ id です。別の id にしてください",
      "unknown-type": "{scope} の {at}: type: {written} は使えません（words / pattern / tokens / module）",
      "bad-module": "{scope} の {at}: module: {written} は使えません。{refusal}",
      "bad-requires": "{scope} の {at}: requires: {written} は求められません（求められるのは pos だけです）",
      "bad-word-list": "{scope} の {at}: word_list: {written} は語彙表の名前として読めません",
      missing: "{scope} の {at}: {field} がありません",
      "unpaired-example": "{scope} の {at}: example の before と after を、ルールが見る言語の同じ言語で書いてください",
      "bad-level": "{scope} の {at}: level: {written} は読めません（error / warning / info）",
      "bad-languages": "{scope} の {at}: languages は言語の並びで書いてください（[ja] や [ja, en]）",
      "no-words": "{scope} の {at}: words に語がありません（「使わない書き方: 使う書き方」か語の並び）",
      "no-tokens": "{scope} の {at}: tokens に語の条件がありません（- { pos: 名詞 } のように並べます）",
      "bad-token": "{scope} の {at}: tokens の {index} 番目に pos・base・surface のどれもありません",
      "unknown-pos": "{scope} の {at}: 品詞 {written} は知りません（{names}）",
      "bad-pattern": "{scope} の {at}: pattern を使えません。{refusal}",
      "bad-depth": `{scope} の {at}: ${unknownDepthSentence("rewrite.depth", "{written}", "ja")}`,
    },
  },
  en: {
    modulePath: {
      outside: "it is outside the folder chaff.yaml is in. Loading a module runs its code, so name a file outside by its absolute path",
    },
    refusal: {
      "too-long": `it is longer than ${String(MAX_PATTERN_LENGTH)} characters; split it into several rules`,
      "nested-quantifier": "it repeats something that repeats (a shape like (a+)+), which can run for minutes on a long line",
      "too-many-repeats": `it has more than ${String(MAX_REPEATS)} repeats of varying count (*, + or {1,9}), which can run for minutes on a long line`,
      backreference: "backreferences (\\1) are not allowed, since they can run for minutes on a long line",
      "empty-match": "it matches an empty string, so it would report every sentence",
      invalid: "it is not a regular expression",
    },
    problems: {
      "not-a-list": "write {scope} as a list of rules (- id: …)",
      "not-a-map": "{scope} {at}: write each rule as an entry with id and type",
      "bad-id": "{scope} {at}: an id starts with a lowercase letter and has only lowercase letters, digits and hyphens (team-no-tbd)",
      "duplicate-id": "{scope} {at}: another rule has the same id",
      "built-in-id": "{scope} {at}: chaff has a rule with this id; choose another",
      "unknown-type": "{scope} {at}: type: {written} is not a type (words / pattern / tokens / module)",
      "bad-module": "{scope} {at}: module: {written} cannot be used: {refusal}",
      "bad-requires": "{scope} {at}: requires: {written} cannot be asked for (only pos can)",
      "bad-word-list": "{scope} {at}: cannot read word_list: {written} as the name of a word list",
      missing: "{scope} {at}: {field} is missing",
      "unpaired-example": "{scope} {at}: write example's before and after in the same language, one the rule checks",
      "bad-level": "{scope} {at}: cannot read level: {written} (error / warning / info)",
      "bad-languages": "{scope} {at}: write languages as a list ([en] or [ja, en])",
      "no-words": "{scope} {at}: words has no words (avoid: use pairs, or a list)",
      "no-tokens": "{scope} {at}: tokens has no conditions (- { pos: noun } and so on)",
      "bad-token": "{scope} {at}: token {index} has none of pos, base and surface",
      "unknown-pos": "{scope} {at}: unknown part of speech {written} ({names})",
      "bad-pattern": "{scope} {at}: the pattern cannot be used: {refusal}",
      "bad-depth": `{scope} {at}: ${unknownDepthSentence("rewrite.depth", "{written}", "en")}`,
    },
  },
};

const PLACEHOLDER = /\{(scope|at|written|field|index|refusal|names)\}/gu;

const refusalOf = (problem: CustomProblem, text: Text): string => {
  if (problem.kind === "bad-pattern") return text.refusal[problem.refusal];
  return problem.kind === "bad-module" ? text.modulePath[problem.refusal] : "";
};

/** The values a problem's sentence names. Each kind carries only some of them. */
const valuesOf = (problem: CustomProblem, text: Text, scope: string): Readonly<Record<string, string>> => ({
  scope,
  at: "at" in problem ? problem.at : "",
  written: "written" in problem ? problem.written : "",
  field: "field" in problem ? problem.field : "",
  index: "index" in problem ? String(problem.index) : "",
  refusal: refusalOf(problem, text),
  names: POS_WRITTEN_NAMES.join(" / "),
});

/** One problem as a sentence. scope names the list the rule is in: custom_rules, or a plugin's rules. */
export const customProblemSentence = (problem: CustomProblem, ui: UiLanguage, scope = "custom_rules"): string => {
  const values = valuesOf(problem, TEXT[ui], scope);
  return TEXT[ui].problems[problem.kind].replace(PLACEHOLDER, (_whole, key: string) => values[key] ?? "");
};

/** What in custom_rules cannot run. Each stops the run: a team's rule that silently does not run looks like a clean document. */
export const customRuleProblems = (config: Pick<Config, "customRules" | "path" | "baseDir">, ui: UiLanguage): string[] =>
  customRulesOf(config).problems.map((problem) => `chaff: ${config.path ?? "chaff.yaml"}: ${customProblemSentence(problem, ui)}`);
