// The index of the rule samples in one language (docs/samples/<language>/README.md): every sample by group, and every
// rule that has none yet, so what is covered shows at a glance. Pure: scripts/samples.ts gives it the rules and samples.
import type { RuleDefinition } from "../packages/chaff/src/plugin.ts";
import { RULE_GROUPS, groupTextOf, type RuleGroup } from "../packages/chaff/src/rule-guide.ts";

/** Whether a rule runs on a document in this language: a rule with no languages runs on all of them. */
export const runsIn = (rule: RuleDefinition, language: string): boolean => rule.languages === undefined || rule.languages.includes(language);

/**
 * The rules a sample in this language can show: those that run on such a document as a lint. A check that reads meaning
 * (layer L4) runs only under chaff test, which sends text to an AI, so its report is not a screen to keep.
 */
export const sampleableRules = (rules: readonly RuleDefinition[], language: string): RuleDefinition[] =>
  rules.filter((rule) => runsIn(rule, language) && rule.status !== "deprecated" && rule.layer !== "L4" && rule.plugin === undefined);

/** The rules that read meaning, which the index names apart. */
export const meaningRules = (rules: readonly RuleDefinition[], language: string): RuleDefinition[] =>
  rules.filter((rule) => runsIn(rule, language) && rule.status !== "deprecated" && rule.layer === "L4");

type IndexText = {
  readonly notice: string;
  readonly title: string;
  readonly intro: readonly string[];
  readonly covered: string;
  readonly columns: string;
  readonly missing: string;
  readonly noneYet: string;
  readonly meaning: string;
  readonly ungrouped: string;
};

const TEXT: Readonly<Record<"ja" | "en", IndexText>> = {
  ja: {
    title: "chaff で直せる文章の見本",
    notice: "<!-- yarn samples:update がルールの定義と見本から作ります。手で書き換えないでください。 -->",
    intro: [
      "chaff が見つけるまちがいを、ルールごとに一つずつ見本にしました。",
      "どの見本も、よくある文章、chaff の指摘、直した文章、直し方、設定の順に並んでいます。",
      "指摘はどれも、その文章に chaff を実際にかけた出力です。",
      "",
      "自分の文章で試すには、Node.js 24 以上で `npx chaffjs 文書.md` と打ちます。入れるものも、設定も要りません。",
      "ブラウザで試すなら[プレイグラウンド](https://isamu.github.io/lab/ja/playground/)へ。",
      "",
      "English samples: [../en/README.md](../en/README.md)",
    ],
    covered: "見本のあるルール:",
    columns: "| ルール | 見つけるもの |\n| --- | --- |",
    missing: "まだ見本の無いルール:",
    noneYet: "このグループの見本はまだありません。",
    meaning: "意味を読む検査は `npx chaffjs test` で AI に尋ねて動くので、決まった出力を見せるこの見本には入れていません:",
    ungrouped: "グループの無いルール",
  },
  en: {
    title: "Samples of what chaff fixes",
    notice: "<!-- yarn samples:update writes this file from the rules and the samples. Do not edit it by hand. -->",
    intro: [
      "One sample per rule: a mistake chaff finds, shown on a short document of the kind where it happens.",
      "Each sample has the original text, what chaff says about it, the corrected text, how it was fixed, and the settings.",
      "What chaff says is its real output on that text.",
      "",
      "To try it on your own text, run `npx chaffjs your-file.md` with Node.js 24 or later. Nothing to install, no settings.",
      "Or paste a draft into the [playground](https://isamu.github.io/lab/en/playground/).",
      "",
      "日本語の見本: [../ja/README.md](../ja/README.md)",
    ],
    covered: "Rules with a sample:",
    columns: "| Rule | What it finds |\n| --- | --- |",
    missing: "Rules with no sample yet:",
    noneYet: "No sample in this group yet.",
    meaning: "The checks that read meaning run under `npx chaffjs test`, which asks an AI, so they have no fixed output to show here:",
    ungrouped: "Rules with no group",
  },
};

const textOf = (language: string): IndexText => TEXT[language === "ja" ? "ja" : "en"];

const oneLine = (text: string): string => text.replace(/\s+/gu, " ").replaceAll("|", "\\|").trim();

const idAfterName = (id: string, language: string): string => (language === "ja" ? `（\`${id}\`）` : ` (\`${id}\`)`);

const rowOf = (rule: RuleDefinition, language: string): string =>
  `| [${oneLine(rule.name[language] ?? rule.id)}](${rule.id}.md)${idAfterName(rule.id, language)} | ${oneLine(rule.guide?.summary[language] ?? "")} |`;

const codeList = (rules: readonly RuleDefinition[]): string => rules.map((rule) => `\`${rule.id}\``).join(", ");

const missingLine = (rules: readonly RuleDefinition[], text: IndexText): string[] => (rules.length === 0 ? [] : ["", `${text.missing} ${codeList(rules)}`]);

const sectionOf = (heading: string, note: string, rules: readonly RuleDefinition[], sampled: ReadonlySet<string>, language: string): string[] => {
  const text = textOf(language);
  const shown = rules.filter((rule) => sampled.has(rule.id));
  const table = shown.length === 0 ? [text.noneYet] : [text.columns, ...shown.map((rule) => rowOf(rule, language))];
  return [
    "",
    `## ${heading}`,
    "",
    ...(note === "" ? [] : [note, ""]),
    ...table,
    ...missingLine(
      rules.filter((rule) => !sampled.has(rule.id)),
      text,
    ),
  ];
};

const groupSection = (group: RuleGroup, rules: readonly RuleDefinition[], sampled: ReadonlySet<string>, language: string): string[] => {
  const inGroup = rules.filter((rule) => rule.guide?.group === group);
  if (inGroup.length === 0) return [];
  const { name, note } = groupTextOf(language, group);
  return sectionOf(name, note, inGroup, sampled, language);
};

/** The index page: the intro, the count, a section per group in the reference's order, and the checks that read meaning. */
export const indexOf = (language: string, rules: readonly RuleDefinition[], sampled: ReadonlySet<string>): string => {
  const text = textOf(language);
  const shown = sampleableRules(rules, language);
  const ungrouped = shown.filter((rule) => rule.guide?.group === undefined);
  const meaning = codeList(meaningRules(rules, language));
  return [
    text.notice,
    "",
    `# ${text.title}`,
    "",
    ...text.intro,
    "",
    `${text.covered} ${String(shown.filter((rule) => sampled.has(rule.id)).length)} / ${String(shown.length)}`,
    ...RULE_GROUPS.flatMap((group) => groupSection(group, shown, sampled, language)),
    ...(ungrouped.length === 0 ? [] : sectionOf(text.ungrouped, "", ungrouped, sampled, language)),
    ...(meaning === "" ? [] : ["", `${text.meaning} ${meaning}`]),
    "",
  ].join("\n");
};

/**
 * The index without its coverage lines (the count, and each group's rules with no sample yet). Those move with every new
 * rule; the rest moves only with a sample, so a test holds the rest to the samples and a new rule need not touch this file.
 */
export const withoutCoverage = (index: string, language: string): string => {
  const text = textOf(language);
  return index
    .split("\n")
    .filter((line) => ![text.covered, text.missing, text.meaning].some((prefix) => line.startsWith(prefix)))
    .join("\n");
};
