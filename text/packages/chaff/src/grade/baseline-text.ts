import type { Texts } from "../ui.ts";

export type BaselineText = {
  readonly unreadable: (path: string, lines: string) => string;
  readonly notComparable: (path: string, differ: string) => string;
  readonly mismatchAllowed: (path: string, differ: string) => string;
  readonly differ: Readonly<Record<"rules" | "settings" | "mixed", string>>;
  readonly heading: (path: string, paired: number) => string;
  readonly unpaired: (onlyBefore: string, onlyAfter: string, readOtherwise: string) => string;
  readonly ratesHeading: (unit: string) => string;
  readonly unit: Readonly<Record<"char" | "word", string>>;
  readonly more: (ids: string) => string;
  readonly fewer: (ids: string) => string;
  readonly inRubric: string;
  readonly newlyFailed: (ids: string) => string;
  readonly newlyPassed: (ids: string) => string;
  readonly newFactsHeading: string;
  readonly droppedAdded: (dropped: string, added: string) => string;
  readonly newCitations: (addresses: string) => string;
  readonly penalty: (before: number, after: number) => string;
  readonly regressionsHeading: (count: number) => string;
  readonly noRegression: string;
  readonly none: string;
};

export const BASELINE_TEXT: Texts<BaselineText> = {
  ja: {
    unreadable: (path, lines) => `${path}: chaff grade --out の 1 回分の結果として読めない行があります（${lines} 行目。形が違うか、id が重なっている）`,
    notComparable: (path, differ) =>
      `${path} とは比べません: ${differ}が違います。ルールか設定が変わった差を、prompt や model の差として読まないため（--allow-stamp-mismatch で比べる）`,
    mismatchAllowed: (path, differ) =>
      `注意: ${path} とは${differ}が違います。--allow-stamp-mismatch で比べています。差には prompt や model の差でないものが混ざります`,
    differ: { rules: "ルール", settings: "設定", mixed: "結果ごとの再現の印" },
    heading: (path, paired) => `${path} と比べた: ${String(paired)} 件の出力が組になった`,
    unpaired: (onlyBefore, onlyAfter, readOtherwise) => `比べられない: 前の回だけ ${onlyBefore}、今回だけ ${onlyAfter}、言語かジャンルが違う ${readOtherwise}`,
    ratesHeading: (unit) => `ルールごとの率（1,000 ${unit}あたり、前 → 後）`,
    unit: { char: "字", word: "語" },
    more: (ids) => `増えた: ${ids}`,
    fewer: (ids) => `減った: ${ids}`,
    inRubric: "（grade: のルール）",
    newlyFailed: (ids) => `新しく落ちた: ${ids}`,
    newlyPassed: (ids) => `新しく通った: ${ids}`,
    newFactsHeading: "新しく落ちた・足された事実と、新しく外れた引用",
    droppedAdded: (dropped, added) => `落ちた ${dropped}、足された ${added}`,
    newCitations: (addresses) => `外れた引用 ${addresses}`,
    penalty: (before, after) => `減点の和: ${String(before)} → ${String(after)}`,
    regressionsHeading: (count) => `回帰 ${String(count)} 件`,
    noRegression: "回帰はありません",
    none: "なし",
  },
  en: {
    unreadable: (path, lines) => `${path}: not the results of one chaff grade --out run (line ${lines}: another shape, or an id already used)`,
    notComparable: (path, differ) =>
      `Not compared with ${path}: the ${differ} differ. A change of rules or settings would read as a change of prompt or model (--allow-stamp-mismatch compares anyway)`,
    mismatchAllowed: (path, differ) =>
      `Note: the ${differ} differ from ${path}; compared because of --allow-stamp-mismatch. Not every change below comes from the prompt or model`,
    differ: { rules: "rules", settings: "settings", mixed: "stamps of its results" },
    heading: (path, paired) => `Compared with ${path}: ${String(paired)} paired ${paired === 1 ? "output" : "outputs"}`,
    unpaired: (onlyBefore, onlyAfter, readOtherwise) =>
      `Not compared: only before ${onlyBefore}; only now ${onlyAfter}; another language or genre ${readOtherwise}`,
    ratesHeading: (unit) => `Rule rates (per 1,000 ${unit}, before → after)`,
    unit: { char: "characters", word: "words" },
    more: (ids) => `more in ${ids}`,
    fewer: (ids) => `fewer in ${ids}`,
    inRubric: "(a grade: rule)",
    newlyFailed: (ids) => `Newly failed: ${ids}`,
    newlyPassed: (ids) => `Newly passed: ${ids}`,
    newFactsHeading: "New dropped or added facts, and new failed quotations",
    droppedAdded: (dropped, added) => `dropped ${dropped}; added ${added}`,
    newCitations: (addresses) => `failed quotations ${addresses}`,
    penalty: (before, after) => `Penalty points: ${String(before)} → ${String(after)}`,
    regressionsHeading: (count) => `${String(count)} ${count === 1 ? "regression" : "regressions"}`,
    noRegression: "No regression",
    none: "none",
  },
};
