import { DETECTORS } from "./detectors/index.ts";
import { resolve } from "./levels.ts";
import type { AdapterNeeds, Finding, Level, ProseDocument, RuleDefinition } from "./plugin.ts";
import { lineStarts, placeOf } from "./position.ts";

export type Skipped = { readonly rule: string; readonly why: string };

export type RunResult = {
  readonly findings: readonly Finding[];
  readonly skipped: readonly Skipped[];
  /** 設定で明示的に有効にした experimental な rule。実行ごとに一度報告する。spec §18.4。 */
  readonly forcedExperimental: readonly string[];
};

export type Settings = Readonly<Record<string, Level>>;

const levelFor = (rule: RuleDefinition, settings: Settings, experimental: boolean): Level => {
  const explicit = settings[rule.id];
  // 明示設定は status の既定に勝つ。名指しで有効にしたものを黙って無効にしない。
  if (explicit !== undefined) return explicit;
  if (rule.status === "experimental" && !experimental) return "off";
  return "normal";
};

const CAPABILITY_NAME: Readonly<Record<string, string>> = { pos: "品詞解析", lemma: "原形" };

/** 知らない要求は満たされていないものとして扱う。黙って無視すると、要求なしで動いてしまう。 */
const has = (capabilities: ProseDocument["capabilities"], need: string): boolean => {
  if (need === "pos") return capabilities.pos;
  if (need === "lemma") return capabilities.lemma;
  return false;
};

/** 要求を満たさない rule は動かせない。満たさないまま動かすと「指摘 0 件」が保証に見える。 */
const unmet = (rule: RuleDefinition, doc: ProseDocument): string | undefined => {
  if (rule.languages !== undefined && !rule.languages.includes(doc.language)) return `${doc.language} 向けの rule ではないため`;
  const missing = rule.requires.find((need) => !has(doc.capabilities, need));
  if (missing === undefined) return undefined;
  return `この言語では${CAPABILITY_NAME[missing] ?? missing}が使えないため`;
};

const forGenre = (rules: readonly RuleDefinition[], genre: string): RuleDefinition[] =>
  rules.filter((rule) => rule.use_for.some((target) => genre.startsWith(target)));

/**
 * 解析器の初期化に払う代金を決める。動く rule が 1 本も要求しないなら読み込まない。
 * capabilities は「払えばできる」の宣言なので、ここでは見ない。
 */
export const neededBy = (rules: readonly RuleDefinition[], settings: Settings, experimental: boolean, genre: string, language: string): AdapterNeeds => ({
  pos: forGenre(rules, genre)
    .filter((rule) => rule.layer !== "L4" && levelFor(rule, settings, experimental) !== "off")
    .filter((rule) => rule.languages === undefined || rule.languages.includes(language))
    .some((rule) => rule.requires.includes("pos") || rule.requires.includes("lemma")),
});

const place = (starts: readonly number[], finding: Finding): Finding => {
  const offset = finding.values["offset"];
  const at = placeOf(starts, typeof offset === "number" ? offset : 0);
  return { ...finding, line: at.line, column: at.column };
};

export const runRules = (doc: ProseDocument, rules: readonly RuleDefinition[], settings: Settings, experimental: boolean, genre: string): RunResult => {
  const starts = lineStarts(doc.source);
  const applicable = forGenre(rules, genre);
  const forced = applicable
    .filter((rule) => rule.status === "experimental" && settings[rule.id] !== undefined && settings[rule.id] !== "off")
    .map((rule) => rule.id);
  const outcome = applicable.reduce<{ findings: Finding[]; skipped: Skipped[] }>(
    (acc, rule) => {
      // L4 は意味を読む検査。chaff test が扱う。ここで「検出器が無い」と言わせない。
      if (rule.layer === "L4") {
        return { findings: acc.findings, skipped: [...acc.skipped, { rule: rule.id, why: "意味を読む検査のため（npx chaff test で動きます）" }] };
      }
      const blocked = unmet(rule, doc);
      if (blocked !== undefined) return { findings: acc.findings, skipped: [...acc.skipped, { rule: rule.id, why: blocked }] };
      const level = levelFor(rule, settings, experimental);
      if (level === "off") {
        const why = rule.status === "experimental" && settings[rule.id] === undefined ? "まだ試験中のため" : "設定で止めているため";
        return { findings: acc.findings, skipped: [...acc.skipped, { rule: rule.id, why }] };
      }
      const detector = DETECTORS[rule.how_to_find];
      if (detector === undefined) return { findings: acc.findings, skipped: [...acc.skipped, { rule: rule.id, why: `検出器 ${rule.how_to_find} がないため` }] };
      const options = {
        limit: resolve(rule, level).limit,
        lexicon: rule.word_list === undefined ? undefined : doc.lexicons[rule.word_list],
        where: rule.where,
      };
      // 語彙表を要求する rule で、その言語に語彙表が無ければ動かせない。黙って通さない。
      if (rule.word_list !== undefined && options.lexicon === undefined) {
        return { findings: acc.findings, skipped: [...acc.skipped, { rule: rule.id, why: `${doc.language} の語彙表 ${rule.word_list} が無いため` }] };
      }
      const found = detector(doc, options).map((finding) => place(starts, { ...finding, rule: rule.id, severity: rule.severity }));
      return { findings: [...acc.findings, ...found], skipped: acc.skipped };
    },
    { findings: [], skipped: [] },
  );
  return { ...outcome, findings: [...outcome.findings].sort((left, right) => left.line - right.line), forcedExperimental: forced };
};
