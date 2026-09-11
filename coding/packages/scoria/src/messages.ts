/**
 * Terminal output is localisable; machine output is not.
 *
 * `Finding.message` in the JSON report stays English so that downstream tooling
 * (SARIF, PR comments, dashboards) reads one stable vocabulary. Only what a person
 * sees in the terminal is translated, and the rule id is the join between them.
 */

export type Lang = "en" | "ja";

const LANGS: readonly Lang[] = ["en", "ja"];

export const isLang = (value: unknown): value is Lang => LANGS.some((lang) => lang === value);

export interface Messages {
  readonly dimension: string;
  readonly score: string;
  readonly confidence: string;
  readonly overall: string;
  readonly notComparable: string;
  readonly findingsAtError: (count: number) => string;
  readonly warnings: (count: number) => string;
  readonly more: (count: number) => string;
  readonly probesNotScored: string;
  readonly detectionDrift: string;
  readonly driftHint: string;
  readonly meanNote: string;
  readonly reportModeNote: string;
  readonly suppressionsInScope: (count: number) => string;
  readonly noSuppressionSignal: string;
  readonly configLabel: string;
  readonly profileLabel: string;
  readonly filesLine: (files: number, sloc: number, testSloc: number) => string;
  readonly wroteConfig: (path: string) => string;
  readonly frozenNote: readonly string[];
  readonly createdConfig: (file: string, summary: string) => string;
  readonly notFrozen: string;
  readonly unknownDimension: (name: string, known: string) => string;
  readonly stackAdded: (id: string) => string;
  readonly stackMissing: (id: string) => string;
  readonly baselineWritten: (path: string) => string;
  readonly whatMoved: string;
  readonly noBaseline: string;
  readonly rebaselineNeeded: (tools: string) => string;
  readonly partlyMeasured: (percent: number) => string;
  readonly fromDimensions: (count: number) => string;
  readonly notComparableLong: string;
  readonly topContributors: (metric: string) => string;
  readonly doctorClean: string;
  readonly doctorFound: (count: number) => string;
  readonly doctorApplied: string;
  readonly doctorFixHint: (count: number) => string;
  readonly doctorScopeNote: string;
  readonly ruleMessages: Readonly<Record<string, string>>;
}

const en: Messages = {
  dimension: "Dimension",
  score: "Score",
  confidence: "Confidence",
  overall: "Overall",
  notComparable: "not comparable across repos",
  findingsAtError: (count) => `${count} findings at severity error`,
  warnings: (count) => `${count} warnings`,
  more: (count) => `… ${count} more`,
  probesNotScored: "probes not scored",
  detectionDrift: "detection drift",
  driftHint: "run `scoria init` to adopt it (the baseline has to be retaken)",
  meanNote: "overall is the plain mean of the dimensions; per-profile weights (spec §10) are not implemented.",
  reportModeNote: "mode: report — this run gates nothing (spec §17.2).",
  suppressionsInScope: (count) => `${count} suppressions in scope`,
  noSuppressionSignal: "no suppression signal wired",
  configLabel: "config",
  profileLabel: "profile",
  filesLine: (files, sloc, testSloc) => `${files} files · ${sloc} sloc · ${testSloc} test sloc`,
  wroteConfig: (path) => `wrote ${path}`,
  frozenNote: [
    "Detection is frozen here. Adding a dependency will not silently change it.",
    "A measurement that changes between runs cannot be compared over time.",
  ],
  createdConfig: (file, summary) => `created ${file} (${summary}). Commit it.`,
  notFrozen: "No config found. Measuring from detection (not frozen).",
  unknownDimension: (name, known) => `unknown dimension: ${name}\nknown: ${known}`,
  stackAdded: (id) => `${id} appeared in package.json but is not in the config`,
  stackMissing: (id) => `${id} is in the config but no longer detected`,
  baselineWritten: (path) => `wrote ${path}. Commit it, and later runs will report the change since.`,
  whatMoved: "What moved",
  noBaseline: "No baseline yet. `scoria baseline` records this run, and later runs report the change since.",
  rebaselineNeeded: (tools) => `${tools} changed version since the baseline; those moves are not regressions`,
  partlyMeasured: (percent) => `only ${percent}% of this dimension could be measured`,
  fromDimensions: (count) => `mean of ${count}`,
  notComparableLong:
    "Scores are not comparable across repositories — only this repository's own trend means anything. " +
    "Read Confidence before Score: anything below `high` means the dimension was measured through suppressions.",
  topContributors: (metric) => `largest contributors to ${metric}`,
  doctorClean: "No gaps found in the project's own gates.",
  doctorFound: (count) => `${count} ${count === 1 ? "gap" : "gaps"} in the gates this project sets for itself`,
  doctorApplied: "applied",
  doctorFixHint: (count) => `${count} more can be applied with \`scoria doctor --fix\``,
  doctorScopeNote: "Only unambiguous repairs are applied. Installing a toolchain is a judgement call and is left to you.",
  ruleMessages: {},
};

const ja: Messages = {
  dimension: "次元",
  score: "スコア",
  confidence: "信頼度",
  overall: "総合",
  notComparable: "repo 間では比較できません",
  findingsAtError: (count) => `error の指摘 ${count} 件`,
  warnings: (count) => `警告 ${count} 件`,
  more: (count) => `… 他 ${count} 件`,
  probesNotScored: "採点されなかった probe",
  detectionDrift: "検出のずれ",
  driftHint: "取り込むなら `scoria init`（baseline の取り直しが要ります）",
  meanNote: "総合は各次元の単純平均です。profile 別の重み（spec §10）は未実装。",
  reportModeNote: "mode: report — この実行は何もゲートしません（spec §17.2）。",
  suppressionsInScope: (count) => `対象範囲に抑制が ${count} 件`,
  noSuppressionSignal: "抑制のシグナルが接続されていません",
  configLabel: "設定",
  profileLabel: "profile",
  filesLine: (files, sloc, testSloc) => `${files} ファイル · ${sloc} sloc · テスト ${testSloc} sloc`,
  wroteConfig: (path) => `${path} を書きました`,
  frozenNote: ["検出結果はここで凍結されます。依存が増えても勝手に追随しません。", "測り方が run ごとに変わると、時系列の比較が成立しないためです。"],
  createdConfig: (file, summary) => `${file} を作成しました（${summary}）。commit してください`,
  notFrozen: "設定がありません。検出したまま測っています（凍結されていません）",
  unknownDimension: (name, known) => `不明な次元: ${name}\n既知: ${known}`,
  stackAdded: (id) => `${id} が package.json にありますが、設定に含まれていません`,
  stackMissing: (id) => `${id} が設定にありますが、検出されません`,
  baselineWritten: (path) => `${path} を書きました。commit すれば、次からは前回との差が出ます。`,
  whatMoved: "動いたもの",
  noBaseline: "baseline がありません。`scoria baseline` でこの実行を記録すると、次から差が出ます。",
  rebaselineNeeded: (tools) => `${tools} の版数が baseline から変わっています。その分の増減は劣化ではありません`,
  partlyMeasured: (percent) => `この軸は ${percent}% しか測れていません`,
  fromDimensions: (count) => `${count} 軸の平均`,
  notComparableLong:
    "点は他のリポジトリと比べられません。意味があるのは同じリポジトリの推移だけです。" +
    "Score より先に Confidence を見てください。`high` 未満は、その軸が抑制ごしに測られたという意味です。",
  topContributors: (metric) => `${metric} に効いているファイル`,
  doctorClean: "プロジェクト自身のゲートに抜けはありません。",
  doctorFound: (count) => `プロジェクトが自分に課しているゲートの抜けが ${count} 件`,
  doctorApplied: "適用しました",
  doctorFixHint: (count) => `残り ${count} 件は \`scoria doctor --fix\` で適用できます`,
  doctorScopeNote: "曖昧さの無い修正だけを適用します。ツールチェインの導入は判断が要るので行いません。",
  ruleMessages: {
    "as-any-no-reason": "型を迂回しています。理由が書かれていません",
    "ts-directive-no-reason": "TypeScript の検査を抑制しています。理由が書かれていません",
    "eslint-disable-no-reason": "eslint の指摘を抑制しています。理由が書かれていません",
    "test-skip-no-reason": "テストが skip / only / todo になっています",
    "god-file": "ファイルが長すぎます",
    "untyped-source": "型検査の対象外です。.ts / .tsx にしてください",
  },
};

export const messagesFor = (lang: Lang): Messages => (lang === "ja" ? ja : en);
