import type { Detector, Finding } from "../plugin.ts";
import { escapeRegExp } from "../orthography.ts";
import { formMinority } from "./form-minority.ts";
import { quoteAround } from "./quote-around.ts";

// 一つの文書で、数の範囲を二通りの記号で書いた所（10〜20 と 10-20、10–20 と 10-20）。どちらが正しいかは決めず、少ないほうを指す。
// 範囲の記号は語彙表 range-notation が言う。

/** 数の範囲 1 つ。form は二つの数のあいだの記号。 */
export type WrittenRange = { readonly offset: number; readonly written: string; readonly form: string };

const FULLWIDTH_OFFSET = 0xfee0;
const NUMBER = "[0-9０-９]+(?:[.．][0-9０-９]+)?";

/** 範囲のすぐ後ろ（空白一つまで）の単位や語。番号にも使う記号（ハイフン）は、これが続くときだけ範囲と読む。 */
const UNIT_AFTER = /^\s?[\p{L}%％]/u;

/** 行の頭（見出しや箇条書きの印の後ろ）の「1-2」は節の番号、閉じ括弧のすぐ後ろの「(703) 292-7827」は電話番号。 */
const LABEL_BEFORE = /(?:^\s*[#>*+|-][\s#>*+|-]*|\)\s?)$/u;

/** 番号の前の札。語彙表の札の語（図、Section）か、頭が大文字の英語の語（NSF）。 */
const isNumberLabel = (lineBefore: string, labels: readonly string[]): boolean => {
  const trimmed = lineBefore.trimEnd();
  if (labels.some((label) => trimmed.endsWith(label))) return true;
  return /^\p{Lu}/u.test(trimmed.split(/\s/u).at(-1) ?? "");
};

const halfWidth = (text: string): string => text.replace(/[０-９．]/gu, (char) => String.fromCharCode(char.charCodeAt(0) - FULLWIDTH_OFFSET));

/**
 * 文字列の中の数の範囲。前後にさらに数が続く並び（日付 2026-10-02、電話番号、時刻 10:00、版 1.2-3）は範囲ではない。
 * 終わりが始まりより小さいもの（郵便番号 100-0001、試合の 3-2）も範囲ではない。ambiguous の記号は、後ろに単位や語が続き、
 * 前が番号の札（図 2-1、Section 1-2、NSF 13-542）でないときだけ。
 */
export const rangesIn = (text: string, marks: readonly string[], ambiguous: readonly string[] = [], labels: readonly string[] = []): WrittenRange[] => {
  if (marks.length === 0) return [];
  const joiner = marks
    .toSorted((left, right) => right.length - left.length)
    .map(escapeRegExp)
    .join("|");
  const pattern = new RegExp(
    `(?<![\\w０-９.．,:：/\\-－–〜～~])(?<from>${NUMBER})\\s?(?<mark>${joiner})\\s?(?<to>${NUMBER})(?![\\w０-９]|[.．,:：/\\-－–〜～~][0-9０-９])`,
    "gu",
  );
  return [...text.matchAll(pattern)].flatMap((match) => {
    const from = Number(halfWidth(match.groups?.["from"] ?? ""));
    const to = Number(halfWidth(match.groups?.["to"] ?? ""));
    const mark = match.groups?.["mark"] ?? "";
    const unitFollows = UNIT_AFTER.test(text.slice(match.index + match[0].length));
    const lineBefore = text.slice(text.lastIndexOf("\n", match.index - 1) + 1, match.index);
    return to > from && !LABEL_BEFORE.test(lineBefore) && (!ambiguous.includes(mark) || (unitFollows && !isNumberLabel(lineBefore, labels)))
      ? [{ offset: match.index, written: match[0], form: mark }]
      : [];
  });
};

export const rangeNotation: Detector = (doc, options): Finding[] => {
  const text = doc.prose ?? doc.source;
  const entries = doc.lexicons["range-notation"] ?? [];
  const ranges = rangesIn(
    text,
    entries.map((entry) => entry.pattern),
    entries.filter((entry) => entry.group === "ambiguous").map((entry) => entry.pattern),
    ["figure-label", "numbered-division", "numbered-label"].flatMap((id) => (doc.lexicons[id] ?? []).map((entry) => entry.pattern)),
  );
  const minority = formMinority(ranges, options.limit);
  if (minority === undefined) return [];
  return minority.odd.map((range) => ({
    rule: "",
    severity: "info",
    line: 0,
    column: 0,
    quote: quoteAround(text, range.offset, range.offset + range.written.length),
    values: { written: range.written, mark: range.form, usual: minority.usual.written, count: minority.odd.length, of: ranges.length, offset: range.offset },
  }));
};
