import type { Config } from "../config/load.ts";
import type { RuleDefinition } from "../plugin.ts";
import { groupTextOf, rulesByGroup } from "../rule-guide.ts";
import { uiLanguageOf, type Texts } from "../ui.ts";
import { nowFor } from "./rules-json.ts";

// `chaff rules`: every rule, grouped the way the reference groups them, with the level it runs at now.
// `chaff rules --json` carries the same and more, for an AI to read.

type RunsWhen = "default" | "experimental" | "team" | "test";

const TEXT: Texts<{
  readonly heading: (genre: string, count: number) => string;
  readonly runsWhen: Readonly<Record<RunsWhen, string>>;
  readonly ungrouped: string;
  readonly footer: readonly string[];
}> = {
  ja: {
    heading: (genre, count) => `chaff のルール ${count} 本（ジャンル ${genre}）`,
    runsWhen: { default: "既定", experimental: "試験中", team: "要設定", test: "AI" },
    ungrouped: "（グループ未設定）",
    footer: [
      "既定: 何も書かなくても動く   試験中: --experimental か chaff.yaml で動く",
      "要設定: chaff.yaml に語や見出しを書いたときだけ   AI: npx chaff test で動く",
      "",
      "詳しく:    npx chaff explain <rule>",
      "AI に渡す: npx chaff rules --json",
    ],
  },
  en: {
    heading: (genre, count) => `chaff's ${count} rules (genre ${genre})`,
    runsWhen: { default: "default", experimental: "experimental", team: "needs list", test: "AI" },
    ungrouped: "(no group yet)",
    footer: [
      "default: runs with no settings   experimental: runs with --experimental or a level in chaff.yaml",
      "needs list: runs only on words or headings listed in chaff.yaml   AI: runs with npx chaff test",
      "",
      "More on one rule:  npx chaff explain <rule>",
      "For an AI:         npx chaff rules --json",
    ],
  },
};

const runsWhenOf = (rule: RuleDefinition): RunsWhen => {
  if (rule.layer === "L4") return "test";
  if (rule.guide?.group === "team") return "team";
  return rule.status === "experimental" ? "experimental" : "default";
};

/** Columns line up in a terminal only if a wide (CJK) character counts as two. */
const widthOf = (text: string): number => Array.from(text).reduce((sum, char) => sum + ((char.codePointAt(0) ?? 0) >= 0x2e80 ? 2 : 1), 0);

const pad = (text: string, width: number): string => `${text}${" ".repeat(Math.max(0, width - widthOf(text)))}`;

/** "normal (100)", "strict (error)", or "off". */
const levelNow = (now: Record<string, unknown>): string => {
  const level = typeof now["level"] === "string" ? now["level"] : "";
  const detail = now["limit"] ?? now["severity"];
  return level !== "off" && (typeof detail === "number" || typeof detail === "string") ? `${level} (${String(detail)})` : level;
};

type Row = { readonly id: string; readonly level: string; readonly runs: string; readonly summary: string };

const rowOf = (rule: RuleDefinition, config: Config, language: string, genre: string): Row => ({
  id: rule.id,
  level: levelNow(nowFor(rule, config, language, genre)),
  runs: TEXT[uiLanguageOf(language)].runsWhen[runsWhenOf(rule)],
  summary: rule.guide?.summary[uiLanguageOf(language)] ?? "",
});

const lineOf = (row: Row, widths: { id: number; level: number; runs: number }): string =>
  `  ${pad(row.id, widths.id)}  ${pad(row.level, widths.level)}  ${pad(row.runs, widths.runs)}  ${row.summary}`.trimEnd();

export const rulesTable = (rules: readonly RuleDefinition[], config: Config, language: string, genre: string): string => {
  const text = TEXT[uiLanguageOf(language)];
  const grouped = rulesByGroup(rules, (rule) => rule.guide?.group).map(({ group, rules: members }) => ({ name: groupTextOf(language, group).name, members }));
  // A rule added without its plain-language fields still shows, so the table never hides a rule that runs.
  const ungrouped = { name: text.ungrouped, members: rules.filter((rule) => rule.guide?.group === undefined) };
  const groups = [...grouped, ungrouped].map(({ name, members }) => ({ name, rows: members.map((rule) => rowOf(rule, config, language, genre)) }));
  const rows = groups.flatMap((group) => group.rows);
  const widths = {
    id: Math.max(...rows.map((row) => widthOf(row.id))),
    level: Math.max(...rows.map((row) => widthOf(row.level))),
    runs: Math.max(...rows.map((row) => widthOf(row.runs))),
  };
  const body = groups.filter((group) => group.rows.length > 0).flatMap((group) => ["", group.name, ...group.rows.map((row) => lineOf(row, widths))]);
  return [text.heading(genre, rows.length), ...body, "", ...text.footer].join("\n");
};
