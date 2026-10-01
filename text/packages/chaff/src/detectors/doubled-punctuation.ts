import type { Detector, Finding } from "../plugin.ts";
import { quoteAround } from "./quote-around.ts";

/**
 * 句読点が二つ並んだところ（「。。」「、。」「,,」「..」）。打ち直しで残った印。
 * 同じ印を三つ以上並べたもの（「...」「。。。」）は、わざと伸ばした書き方なので数えない。その後ろに一つだけ付けた印（「...。」）も数えない。
 * コロンは「::」（C++ の名前、IPv6）があるので見ない。
 */
const PUNCTUATION_RUN = /[、。，．,.;；]{2,}/gu;

/** 略語の点の後ろの読点やセミコロン（e.g.,、Inc.,、etc.;）。 */
const AFTER_ABBREVIATION = /^\.[,;]$/u;

const WORD = /[\p{L}\p{N}]/u;

/** 「..」の前後が字か数字か「/」なら、範囲や道のり（1..10、a..b、../）で、書き損じではない。 */
const JOINED = /[\p{L}\p{N}/]/u;

const isDrawnOut = (run: string): boolean => run.length >= 3 && [...run].every((mark) => mark === run.charAt(0));

/** 伸ばした印（「...」「、、、」）は三点リーダーの代わりで、すぐ後ろの一つの印（「...。」「、、、。」）は文を閉じる印。 */
const isDrawnOutThenClosed = (run: string): boolean => isDrawnOut(run.slice(0, -1));

const isJoinedDots = (text: string, start: number, run: string): boolean =>
  run === ".." && (JOINED.test(text.charAt(start + run.length)) || text.charAt(start - 1) === "/");

export type DoubledMarks = { readonly start: number; readonly run: string };

/** 並びの終わりの点が次の語の頭（「、.NET」「。.well-known」）なら、その点は語のうち。 */
const withoutWordDot = (text: string, found: DoubledMarks): DoubledMarks =>
  found.run.endsWith(".") && !isDrawnOut(found.run) && found.run !== ".." && WORD.test(text.charAt(found.start + found.run.length))
    ? { start: found.start, run: found.run.slice(0, -1) }
    : found;

const isSlip = (text: string, { start, run }: DoubledMarks): boolean =>
  run.length >= 2 && !isDrawnOut(run) && !isDrawnOutThenClosed(run) && !AFTER_ABBREVIATION.test(run) && !isJoinedDots(text, start, run);

/** text の中の、句読点が重なった並び（位置と並び）。 */
export const doubledMarks = (text: string): DoubledMarks[] =>
  [...text.matchAll(PUNCTUATION_RUN)].map((match) => withoutWordDot(text, { start: match.index, run: match[0] })).filter((found) => isSlip(text, found));

export const doubledPunctuation: Detector = (doc): Finding[] => {
  const text = doc.prose ?? doc.source;
  return doubledMarks(text).map(({ start, run }) => ({
    rule: "",
    severity: "warning",
    line: 0,
    column: 0,
    quote: quoteAround(text, start, start + run.length),
    values: { marks: run, offset: start },
  }));
};
