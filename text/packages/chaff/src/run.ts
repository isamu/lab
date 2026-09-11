import { DETECTORS } from "./detectors/index.ts";
import { resolve } from "./levels.ts";
import type { Finding, Level, ProseDocument, RuleDefinition } from "./plugin.ts";
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

const place = (starts: readonly number[], finding: Finding): Finding => {
  const offset = finding.values["offset"];
  const at = placeOf(starts, typeof offset === "number" ? offset : 0);
  return { ...finding, line: at.line, column: at.column };
};

export const runRules = (doc: ProseDocument, rules: readonly RuleDefinition[], settings: Settings, experimental: boolean, genre: string): RunResult => {
  const starts = lineStarts(doc.source);
  const applicable = rules.filter((rule) => rule.use_for.some((target) => genre.startsWith(target)));
  const forced = applicable
    .filter((rule) => rule.status === "experimental" && settings[rule.id] !== undefined && settings[rule.id] !== "off")
    .map((rule) => rule.id);
  const outcome = applicable.reduce<{ findings: Finding[]; skipped: Skipped[] }>(
    (acc, rule) => {
      const level = levelFor(rule, settings, experimental);
      if (level === "off") {
        const why = rule.status === "experimental" && settings[rule.id] === undefined ? "まだ試験中のため" : "設定で止めているため";
        return { findings: acc.findings, skipped: [...acc.skipped, { rule: rule.id, why }] };
      }
      const detector = DETECTORS[rule.how_to_find];
      if (detector === undefined) return { findings: acc.findings, skipped: [...acc.skipped, { rule: rule.id, why: `検出器 ${rule.how_to_find} がないため` }] };
      const found = detector(doc, { limit: resolve(rule, level).limit }).map((finding) => place(starts, { ...finding, severity: rule.severity }));
      return { findings: [...acc.findings, ...found], skipped: acc.skipped };
    },
    { findings: [], skipped: [] },
  );
  return { ...outcome, findings: [...outcome.findings].sort((left, right) => left.line - right.line), forcedExperimental: forced };
};
