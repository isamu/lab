import type { Texts, UiLanguage } from "../ui.ts";
import type { RuleFailure } from "./module-detector.ts";
import type { ShapeProblem } from "./returned-findings.ts";

// Why a plugin's rule is listed as not run on a document, in the reader's language. It names where the detector came
// from, so the person who wrote it knows which file to open.

type Text = {
  readonly reason: (origin: string, what: string) => string;
  readonly threw: (message: string) => string;
  /** Each wrong return, with the finding's number and what was there. */
  readonly shape: Readonly<Record<ShapeProblem["kind"], (index: string, written: string) => string>>;
};

const TEXT: Texts<Text> = {
  ja: {
    reason: (origin, what) => `${origin} の検出器が${what}ため`,
    threw: (message) => `エラーを投げた（${message}）`,
    shape: {
      "not-a-list": (_index, written) => `指摘の並びでなく ${written} を返した`,
      "not-a-finding": (index, written) => `${index} 番目の指摘に { start } の形でないもの（${written}）を返した`,
      "bad-start": (index, written) => `${index} 番目の指摘の start に ${written} を返した（文書の中の位置を整数で返します）`,
      "bad-end": (index, written) => `${index} 番目の指摘の end に ${written} を返した（start 以上、文書の長さ以下の整数で返します）`,
      "bad-values": (index, written) => `${index} 番目の指摘の values に文字列と数でない値を入れた（${written}）`,
    },
  },
  en: {
    reason: (origin, what) => `the detector in ${origin} ${what}`,
    threw: (message) => `threw an error (${message})`,
    shape: {
      "not-a-list": (_index, written) => `returned ${written}, not a list of findings`,
      "not-a-finding": (index, written) => `returned ${written} as finding ${index}, not a { start } finding`,
      "bad-start": (index, written) => `returned start ${written} in finding ${index} (an offset in the document, a whole number)`,
      "bad-end": (index, written) => `returned end ${written} in finding ${index} (a whole number from start to the document's length)`,
      "bad-values": (index, written) => `put a value that is not a string or a number in finding ${index}'s values (${written})`,
    },
  },
};

/** The reason a rule whose detector failed is listed as not run. */
export const failureReason = (origin: string, failure: RuleFailure, ui: UiLanguage): string => {
  const text = TEXT[ui];
  if (failure.kind === "threw") return text.reason(origin, text.threw(failure.message));
  const { kind, index, written } = failure.problem;
  return text.reason(origin, text.shape[kind](String(index), written));
};
