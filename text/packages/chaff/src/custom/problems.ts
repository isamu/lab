import type { Config } from "../config/load.ts";
import type { Texts, UiLanguage } from "../ui.ts";
import type { CustomProblem } from "./parse.ts";
import { customRulesOf } from "./load.ts";
import { MAX_PATTERN_LENGTH, MAX_REPEATS, type RegexRefusal } from "./regex-safety.ts";
import { POS_WRITTEN_NAMES } from "./token-pattern.ts";

type Text = { readonly problem: (problem: CustomProblem) => string; readonly refusal: Readonly<Record<RegexRefusal, string>> };

const TEXT: Texts<Text> = {
  ja: {
    refusal: {
      "too-long": `${String(MAX_PATTERN_LENGTH)} 字を超えています。いくつかのルールに分けてください`,
      "nested-quantifier": "繰り返しの中に繰り返しがあります（(a+)+ のような形）。長い行で止まらなくなるので使えません",
      "too-many-repeats": `回数の決まらない繰り返し（* や + や {1,9}）が ${String(MAX_REPEATS)} つを超えています。長い行で止まらなくなることがあります`,
      backreference: "後方参照（\\1）は使えません。長い行で止まらなくなることがあるためです",
      "empty-match": "何も無い所にも当たります。すべての文で指摘が出てしまいます",
      invalid: "正規表現として読めません",
    },
    problem: (problem) => {
      if (problem.kind === "not-a-list") return "custom_rules はルールの並び（- id: …）で書いてください";
      const at = `custom_rules の ${problem.at}`;
      if (problem.kind === "not-a-map") return `${at}: id や type を持つ項目として書いてください`;
      if (problem.kind === "bad-id") return `${at}: id は英小文字で始まり、英小文字・数字・ハイフンだけで書きます（例: team-no-tbd）`;
      if (problem.kind === "duplicate-id") return `${at}: 同じ id のルールがもう一つあります`;
      if (problem.kind === "built-in-id") return `${at}: chaff のルールと同じ id です。別の id にしてください`;
      if (problem.kind === "unknown-type") return `${at}: type: ${problem.written} は使えません（words / pattern / tokens）`;
      if (problem.kind === "not-yet") return `${at}: type: ${problem.written} はまだ使えません（words / pattern / tokens）`;
      if (problem.kind === "missing") return `${at}: ${problem.field} がありません`;
      if (problem.kind === "bad-level") return `${at}: level: ${problem.written} は読めません（error / warning / info）`;
      if (problem.kind === "bad-languages") return `${at}: languages は言語の並びで書いてください（[ja] や [ja, en]）`;
      if (problem.kind === "no-words") return `${at}: words に語がありません（「使わない書き方: 使う書き方」か語の並び）`;
      if (problem.kind === "no-tokens") return `${at}: tokens に語の条件がありません（- { pos: 名詞 } のように並べます）`;
      if (problem.kind === "bad-token") return `${at}: tokens の ${String(problem.index)} 番目に pos・base・surface のどれもありません`;
      if (problem.kind === "unknown-pos") return `${at}: 品詞 ${problem.written} は知りません（${POS_WRITTEN_NAMES.join(" / ")}）`;
      return `${at}: pattern を使えません。${TEXT.ja.refusal[problem.refusal]}`;
    },
  },
  en: {
    refusal: {
      "too-long": `it is longer than ${String(MAX_PATTERN_LENGTH)} characters; split it into several rules`,
      "nested-quantifier": "it repeats something that repeats (a shape like (a+)+), which can run for minutes on a long line",
      "too-many-repeats": `it has more than ${String(MAX_REPEATS)} repeats of varying count (*, + or {1,9}), which can run for minutes on a long line`,
      backreference: "backreferences (\\1) are not allowed, since they can run for minutes on a long line",
      "empty-match": "it matches an empty string, so it would report every sentence",
      invalid: "it is not a regular expression",
    },
    problem: (problem) => {
      if (problem.kind === "not-a-list") return "write custom_rules as a list of rules (- id: …)";
      const at = `custom_rules ${problem.at}`;
      if (problem.kind === "not-a-map") return `${at}: write each rule as an entry with id and type`;
      if (problem.kind === "bad-id") return `${at}: an id starts with a lowercase letter and has only lowercase letters, digits and hyphens (team-no-tbd)`;
      if (problem.kind === "duplicate-id") return `${at}: another rule has the same id`;
      if (problem.kind === "built-in-id") return `${at}: chaff has a rule with this id; choose another`;
      if (problem.kind === "unknown-type") return `${at}: type: ${problem.written} is not a type (words / pattern / tokens)`;
      if (problem.kind === "not-yet") return `${at}: type: ${problem.written} is not supported yet (words / pattern / tokens)`;
      if (problem.kind === "missing") return `${at}: ${problem.field} is missing`;
      if (problem.kind === "bad-level") return `${at}: cannot read level: ${problem.written} (error / warning / info)`;
      if (problem.kind === "bad-languages") return `${at}: write languages as a list ([en] or [ja, en])`;
      if (problem.kind === "no-words") return `${at}: words has no words (avoid: use pairs, or a list)`;
      if (problem.kind === "no-tokens") return `${at}: tokens has no conditions (- { pos: noun } and so on)`;
      if (problem.kind === "bad-token") return `${at}: token ${String(problem.index)} has none of pos, base and surface`;
      if (problem.kind === "unknown-pos") return `${at}: unknown part of speech ${problem.written} (${POS_WRITTEN_NAMES.join(" / ")})`;
      return `${at}: the pattern cannot be used: ${TEXT.en.refusal[problem.refusal]}`;
    },
  },
};

/** What in custom_rules cannot run. Each stops the run: a team's rule that silently does not run looks like a clean document. */
export const customRuleProblems = (config: Pick<Config, "customRules" | "path">, ui: UiLanguage): string[] =>
  customRulesOf(config).problems.map((problem) => `chaff: ${config.path ?? "chaff.yaml"}: ${TEXT[ui].problem(problem)}`);
