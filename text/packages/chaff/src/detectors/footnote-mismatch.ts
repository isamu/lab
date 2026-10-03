import type { Detector, Finding } from "../plugin.ts";
import { escapeRegExp } from "../orthography.ts";
import { quoteAround } from "./quote-around.ts";

// 注の無い注の印と、本文が一度も付けない注。Markdown の脚注（[^1] と行頭の [^1]:）と、語彙表 note-mark の印（※1 と行頭の ※1）を読む。

/** 合わない注 1 つ。missing は印に注が無い、unused は注に印が無い。label は書いたままの印（[^1]、※1）。 */
export type NoteSlip = { readonly offset: number; readonly label: string; readonly reason: "missing" | "unused" };

/** 印 1 つ。kind は印の種類（markdown か note-mark の語）、key は番号、note は行の頭の注そのものか。 */
type NoteMark = { readonly offset: number; readonly label: string; readonly kind: string; readonly key: string; readonly note: boolean };

const MARKDOWN = "markdown";
const FULLWIDTH_OFFSET = 0xfee0;
/** 行の頭から印までに来てよいもの（字下げ、箇条書きの印、開き括弧）。 */
const NOTE_LINE_HEAD = /^[ \t]*(?:[-*+][ \t]+)?[（(]?$/u;

const halfWidth = (text: string): string => text.replace(/[０-９]/gu, (char) => String.fromCharCode(char.charCodeAt(0) - FULLWIDTH_OFFSET));

const lineHeadOf = (text: string, offset: number): string => text.slice(text.lastIndexOf("\n", offset - 1) + 1, offset);

/** Markdown の脚注。名前は大文字と小文字を区別しない（CommonMark の参照と同じ）。 */
const markdownMarks = (text: string): NoteMark[] =>
  [...text.matchAll(/\[\^(?<key>[^\]\s]+)\](?<colon>:)?/gu)].map((match) => {
    const note = match.groups?.["colon"] !== undefined && /^[ \t]{0,3}$/u.test(lineHeadOf(text, match.index));
    return { offset: match.index, label: `[^${match.groups?.["key"] ?? ""}]`, kind: MARKDOWN, key: (match.groups?.["key"] ?? "").toLowerCase(), note };
  });

/** 印と一桁か二桁の番号。後ろに数字や小数が続けば年や数（※2018年度、※1.2倍）で、注の番号ではない。 */
const wordMarks = (text: string, mark: string): NoteMark[] =>
  [...text.matchAll(new RegExp(`${escapeRegExp(mark)}(?<key>[0-9０-９]{1,2})(?![0-9０-９]|[.．,，][0-9０-９])`, "gu"))].map((match) => ({
    offset: match.index,
    label: match[0],
    kind: mark,
    key: halfWidth(match.groups?.["key"] ?? ""),
    note: NOTE_LINE_HEAD.test(lineHeadOf(text, match.index)),
  }));

/** 一つの種類の印のうち、合わないもの。印の語（※）は、その種類の注が一つも無ければ注を別に置いた文書と読んで言わない。 */
const slipsOfKind = (marks: readonly NoteMark[], kind: string): NoteSlip[] => {
  const ofKind = marks.filter((mark) => mark.kind === kind);
  const notes = new Set(ofKind.filter((mark) => mark.note).map((mark) => mark.key));
  const referenced = new Set(ofKind.filter((mark) => !mark.note).map((mark) => mark.key));
  if (notes.size === 0 && kind !== MARKDOWN) return [];
  const missing = ofKind
    .filter((mark) => !mark.note && !notes.has(mark.key))
    .map((mark): NoteSlip => ({ offset: mark.offset, label: mark.label, reason: "missing" }));
  const unused = ofKind
    .filter((mark) => mark.note && !referenced.has(mark.key))
    .map((mark): NoteSlip => ({ offset: mark.offset, label: mark.label, reason: "unused" }));
  return [...missing, ...unused];
};

/** 文字列の中の、注の無い印と印の無い注。 */
export const noteSlips = (text: string, words: readonly string[]): NoteSlip[] => {
  const marks = [...markdownMarks(text), ...words.flatMap((word) => wordMarks(text, word))];
  return [...new Set(marks.map((mark) => mark.kind))].flatMap((kind) => slipsOfKind(marks, kind)).toSorted((left, right) => left.offset - right.offset);
};

export const footnoteMismatch: Detector = (doc): Finding[] => {
  const text = doc.prose ?? doc.source;
  const words = (doc.lexicons["note-mark"] ?? []).map((entry) => entry.pattern);
  return noteSlips(text, words).map((slip) => ({
    rule: "",
    severity: "warning",
    line: 0,
    column: 0,
    quote: quoteAround(text, slip.offset, slip.offset + slip.label.length),
    values: { label: slip.label, offset: slip.offset },
    variant: slip.reason,
  }));
};
