import type { Config } from "./load.ts";
import type { RuleDefinition } from "../plugin.ts";
import type { Texts, UiLanguage } from "../ui.ts";
import { allowOf, type AllowProblem } from "../allow.ts";
import { MAX_PATTERN_LENGTH, MAX_REPEATS, type RegexRefusal } from "../custom/regex-safety.ts";

type Text = {
  readonly problem: Readonly<Record<AllowProblem["kind"], (at: string) => string>>;
  readonly refusal: Readonly<Record<RegexRefusal, string>>;
  readonly unknownRule: (at: string, id: string) => string;
};

const TEXT: Texts<Text> = {
  ja: {
    problem: {
      "not-a-list": (written) => `allow は項目の並びで書いてください（- text: … と reason: …）。読めなかった値: ${written}`,
      "not-a-map": (at) => `${at}: text（または pattern）と reason を持つ項目として書いてください`,
      "no-reason": (at) => `${at}: reason がありません。なぜ指摘しなくてよいのかを書いてください（chaff suppressions に並びます）`,
      "no-target": (at) => `${at}: text（そのままの文字列）か pattern（正規表現）のどちらかを書いてください`,
      "both-targets": (at) => `${at}: text と pattern の両方があります。どちらか一つにしてください`,
      "bad-rules": (at) => `${at}: rules はルール名の並びで書いてください（[preferred-term] や [preferred-term, spelling-consistency]）`,
      "bad-files": (at) => `${at}: files は glob の並びで書いてください（["docs/**/*.md"]）`,
      "bad-pattern": (at) => `${at}: pattern を使えません。`,
    },
    refusal: {
      "too-long": `${String(MAX_PATTERN_LENGTH)} 字を超えています。いくつかの項目に分けてください`,
      "nested-quantifier": "繰り返しの中に繰り返しがあります（(a+)+ のような形）。長い行で止まらなくなるので使えません",
      "too-many-repeats": `回数の決まらない繰り返し（* や + や {1,9}）が ${String(MAX_REPEATS)} つを超えています。長い行で止まらなくなることがあります`,
      backreference: "後方参照（\\1）は使えません。長い行で止まらなくなることがあるためです",
      "empty-match": "何も無い所にも当たります。すべての指摘が消えてしまいます",
      invalid: "正規表現として読めません",
    },
    unknownRule: (at, id) => `${at}: rules の ${id} というルールはありません（npx chaffjs rules --json で一覧が出ます）`,
  },
  en: {
    problem: {
      "not-a-list": (written) => `write allow as a list of entries (- text: … with reason: …); could not read ${written}`,
      "not-a-map": (at) => `${at}: write each entry with text (or pattern) and reason`,
      "no-reason": (at) => `${at}: reason is missing; say why this need not be reported (chaff suppressions lists it)`,
      "no-target": (at) => `${at}: write either text (a literal string) or pattern (a regular expression)`,
      "both-targets": (at) => `${at}: has both text and pattern; keep one`,
      "bad-rules": (at) => `${at}: write rules as a list of rule ids ([preferred-term] or [preferred-term, spelling-consistency])`,
      "bad-files": (at) => `${at}: write files as a list of globs (["docs/**/*.md"])`,
      "bad-pattern": (at) => `${at}: the pattern cannot be used: `,
    },
    refusal: {
      "too-long": `it is longer than ${String(MAX_PATTERN_LENGTH)} characters; split it into several entries`,
      "nested-quantifier": "it repeats something that repeats (a shape like (a+)+), which can run for minutes on a long line",
      "too-many-repeats": `it has more than ${String(MAX_REPEATS)} repeats of varying count (*, + or {1,9}), which can run for minutes on a long line`,
      backreference: "backreferences (\\1) are not allowed, since they can run for minutes on a long line",
      "empty-match": "it matches an empty string, so it would silence every finding",
      invalid: "it is not a regular expression",
    },
    unknownRule: (at, id) => `${at}: there is no rule named ${id} under rules (npx chaffjs rules --json lists them)`,
  },
};

const sentenceOf = (problem: AllowProblem, text: Text): string => {
  if (problem.kind === "not-a-list") return text.problem[problem.kind](problem.written);
  const head = text.problem[problem.kind](problem.at);
  return problem.kind === "bad-pattern" ? `${head}${text.refusal[problem.refusal]}` : head;
};

/** What in allow: cannot be used. Each stops the run, as an unreadable custom rule does: an allowance without its reason is not taken. */
export const allowProblems = (config: Pick<Config, "allow" | "path">, ui: UiLanguage): string[] =>
  allowOf(config.allow).problems.map((problem) => `chaff: ${config.path ?? "chaff.yaml"}: ${sentenceOf(problem, TEXT[ui])}`);

/** Rule ids under an entry's rules: that chaff does not have. Said before the results, like an unknown id under rules:. */
export const allowRuleWarnings = (config: Pick<Config, "allow" | "path">, known: readonly Pick<RuleDefinition, "id">[], ui: UiLanguage): string[] => {
  const ids = new Set(known.map((rule) => rule.id));
  const where = config.path ?? "chaff.yaml";
  return allowOf(config.allow).entries.flatMap((entry) =>
    entry.rules.filter((id) => !ids.has(id)).map((id) => `${where}: ${TEXT[ui].unknownRule(entry.at, id)}`),
  );
};
