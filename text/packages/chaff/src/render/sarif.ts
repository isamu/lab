import { localized, messageOf } from "./text.ts";
import type { Finding, RuleDefinition, Severity } from "../plugin.ts";

/**
 * 指摘を SARIF 2.1.0 で出す。GitHub の code scanning に上げるため。
 *
 * 上げると Security タブに並ぶだけでなく、**PR の変更行に直接出る**。
 * ログの中の指摘は読みに行かないと見えないが、行の上の指摘は書いた本人の目の前にある。
 * chaff は文章を直す人のための道具なので、ここが効く。
 */
const SCHEMA = "https://json.schemastore.org/sarif-2.1.0.json";
const INFORMATION_URI = "https://www.npmjs.com/package/chaffjs";

/** SARIF に info は無い。上げるときに弾かれるので、note に写す。 */
type Level = "error" | "warning" | "note";

const levelOf = (severity: Severity): Level => (severity === "info" ? "note" : severity);

type SarifRule = {
  readonly id: string;
  readonly name: string;
  readonly shortDescription: { readonly text: string };
  readonly fullDescription: { readonly text: string };
  readonly help: { readonly text: string };
  readonly properties: { readonly tags: readonly string[] };
};

type SarifResult = {
  readonly ruleId: string;
  readonly level: Level;
  readonly message: { readonly text: string };
  readonly locations: readonly {
    readonly physicalLocation: {
      readonly artifactLocation: { readonly uri: string };
      readonly region: { readonly startLine: number; readonly startColumn: number };
    };
  }[];
};

/** `chaff/<rule>` と名前空間を切る。同じ PR に上がる他のツールの rule id と衝突させない。 */
const ruleIdOf = (rule: string): string => `chaff/${rule}`;

/** 指摘 1 件と、それを描くのに要るもの。言語はファイルごとに違う。 */
export type Located = { readonly path: string; readonly finding: Finding; readonly language: string; readonly rules: readonly RuleDefinition[] };

const ruleFor = (located: Located): RuleDefinition | undefined => located.rules.find((rule) => rule.id === located.finding.rule);

const sarifRule = (rule: RuleDefinition, language: string): SarifRule => ({
  id: ruleIdOf(rule.id),
  name: rule.id,
  shortDescription: { text: localized(rule.name, language) },
  // なぜ直すのかと、どう直すのかを一緒に上げる。指摘だけでは書いた人が動けない。
  fullDescription: { text: localized(rule.why, language) },
  help: { text: localized(rule.how_to_fix, language) },
  properties: { tags: [rule.layer, ...rule.use_for] },
});

const resultOf = (located: Located): SarifResult => {
  const rule = ruleFor(located);
  return {
    ruleId: ruleIdOf(located.finding.rule),
    level: levelOf(located.finding.severity),
    message: { text: rule === undefined ? located.finding.rule : messageOf(rule, located.finding, located.language) },
    locations: [
      {
        physicalLocation: {
          artifactLocation: { uri: located.path },
          // SARIF の行と桁は 1 始まり。0 を上げると弾かれる。
          region: { startLine: Math.max(1, located.finding.line), startColumn: Math.max(1, located.finding.column) },
        },
      },
    ],
  };
};

/** 同じ rule が 2 言語で出たら、先に出たほうの言語で 1 度だけ書く。SARIF は rule を 1 つしか持てない。 */
const usedRules = (located: readonly Located[]): SarifRule[] => {
  const seen = new Map<string, Located>();
  located.forEach((entry) => {
    if (!seen.has(entry.finding.rule)) seen.set(entry.finding.rule, entry);
  });
  return [...seen.values()].flatMap((entry) => {
    const rule = ruleFor(entry);
    return rule === undefined ? [] : [sarifRule(rule, entry.language)];
  });
};

export const renderSarif = (located: readonly Located[], version: string): string => {
  return `${JSON.stringify(
    {
      $schema: SCHEMA,
      version: "2.1.0",
      runs: [
        {
          tool: { driver: { name: "chaff", version, informationUri: INFORMATION_URI, rules: usedRules(located) } },
          results: located.map(resultOf),
        },
      ],
    },
    null,
    2,
  )}\n`;
};
