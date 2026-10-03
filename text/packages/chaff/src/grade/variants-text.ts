import type { Texts } from "../ui.ts";

export type VariantText = {
  readonly heading: (compared: number, variants: number) => string;
  readonly passed: string;
  readonly passedCell: (passed: number, outputs: number, rate: string) => string;
  readonly factsDropped: string;
  readonly factsAdded: string;
  readonly citationsFailed: string;
  readonly citationsCell: (failed: number, checked: number) => string;
  readonly unsupportedFacts: string;
  readonly penalty: string;
  readonly ratesHeading: (unit: string) => string;
  readonly unit: Readonly<Record<"char" | "word", string>>;
  readonly disagreeHeading: (count: number) => string;
  readonly disagreement: (id: string, passedIn: string, failedIn: string) => string;
  readonly failedIn: (variant: string, reasons: string) => string;
  readonly noDisagreement: string;
  readonly missing: (id: string, variants: string) => string;
  readonly readOtherwise: (ids: string) => string;
  readonly notComparedHeading: string;
  /** Markdown only: the run's heading and its totals. */
  readonly runHeading: (path: string) => string;
  readonly totals: (total: number, passed: number) => string;
  readonly failedHeading: string;
  readonly regressionsHeading: (count: number) => string;
  readonly noRegression: string;
  readonly stamp: string;
  readonly separator: string;
};

export const VARIANT_TEXT: Texts<VariantText> = {
  ja: {
    heading: (compared, variants) => `${String(variants)} つの variant を並べた: どの variant にもある id の出力 ${String(compared)} 件`,
    passed: "通った",
    passedCell: (passed, outputs, rate) => `${String(passed)}/${String(outputs)}（${rate}）`,
    factsDropped: "落ちた事実",
    factsAdded: "足された事実",
    citationsFailed: "外れた引用",
    citationsCell: (failed, checked) => `${String(failed)}/${String(checked)}`,
    unsupportedFacts: "一節に無い事実",
    penalty: "減点の和",
    ratesHeading: (unit) => `ルールごとの率（1,000 ${unit}あたり）`,
    unit: { char: "字", word: "語" },
    disagreeHeading: (count) => `合否が分かれた出力 ${String(count)} 件`,
    disagreement: (id, passedIn, failedIn) => `${id}: 通った ${passedIn}、落ちた ${failedIn}`,
    failedIn: (variant, reasons) => `${variant}（${reasons}）`,
    noDisagreement: "合否が分かれた出力はありません",
    missing: (id, variants) => `${id}: ${variants} に無い`,
    readOtherwise: (ids) => `言語かジャンルが違う: ${ids}`,
    notComparedHeading: "比べなかった id",
    runHeading: (path) => `chaff grade: ${path}`,
    totals: (total, passed) => `${String(total)} 件の出力、${String(passed)} 件が通り、${String(total - passed)} 件が落ちた`,
    failedHeading: "落ちた出力",
    regressionsHeading: (count) => `前の回と比べた回帰 ${String(count)} 件`,
    noRegression: "前の回と比べた回帰はありません",
    stamp: "再現の印",
    separator: "、",
  },
  en: {
    heading: (compared, variants) =>
      `${String(variants)} variants side by side: ${String(compared)} ${compared === 1 ? "output" : "outputs"} with an id every variant has`,
    passed: "Passed",
    passedCell: (passed, outputs, rate) => `${String(passed)}/${String(outputs)} (${rate})`,
    factsDropped: "Facts dropped",
    factsAdded: "Facts added",
    citationsFailed: "Quotations failed",
    citationsCell: (failed, checked) => `${String(failed)}/${String(checked)}`,
    unsupportedFacts: "Unsupported facts",
    penalty: "Penalty points",
    ratesHeading: (unit) => `Rule rates (per 1,000 ${unit})`,
    unit: { char: "characters", word: "words" },
    disagreeHeading: (count) => `${String(count)} ${count === 1 ? "output" : "outputs"} where pass or fail differs`,
    disagreement: (id, passedIn, failedIn) => `${id}: passed in ${passedIn}; failed in ${failedIn}`,
    failedIn: (variant, reasons) => `${variant} (${reasons})`,
    noDisagreement: "Every variant passed or failed the same outputs",
    missing: (id, variants) => `${id}: missing from ${variants}`,
    readOtherwise: (ids) => `another language or genre: ${ids}`,
    notComparedHeading: "Ids not compared",
    runHeading: (path) => `chaff grade: ${path}`,
    totals: (total, passed) => `${String(total)} outputs, ${String(passed)} passed, ${String(total - passed)} failed`,
    failedHeading: "Failed outputs",
    regressionsHeading: (count) => `${String(count)} ${count === 1 ? "regression" : "regressions"} against the baseline`,
    noRegression: "No regression against the baseline",
    stamp: "Stamp",
    separator: "; ",
  },
};
