import type { Span } from "../plugin.ts";

/** 行の頭の引用の印と字下げ、箇条の印、チェックボックス。この後ろで太字が開く。 */
const QUOTE_INDENT = /^(?:[ \t]*>)*[ \t]*/u;
const ITEM_MARKER = /^(?:[-*+]|\d{1,9}[.)])[ \t]+/u;
const TASK_BOX = /^\[[ xX]\][ \t]+/u;
const BOLD = /^(?:\*\*|__)$/u;

type Opening = { readonly marker: string; readonly item: boolean };

/** 行の頭から文の始まりまで（before）が、印の後ろで開いた太字だけか。 */
const openingOf = (before: string): Opening | undefined => {
  const unquoted = before.replace(QUOTE_INDENT, "");
  const rest = unquoted.replace(ITEM_MARKER, "").replace(TASK_BOX, "");
  return BOLD.test(rest) ? { marker: rest, item: rest.length < unquoted.length } : undefined;
};

/** 段落の切れ目になる前の行: 空の行（引用の中の空の行も）と見出し。 */
const BLOCK_BEFORE = /^(?:[ \t]*>)*[ \t]*(?:#.*)?$/u;

/** 文の終わりの句読点。札の句点を太字の外に書く形（**速く書ける**。）もある。 */
const STOP = /[。．.！？!?]$/u;

const lineAround = (source: string, offset: number): { readonly start: number; readonly end: number } => {
  const end = source.indexOf("\n", offset);
  return { start: source.lastIndexOf("\n", offset - 1) + 1, end: end === -1 ? source.length : end };
};

/** 太字が閉じる位置。文の直後か、文末の句読点の直前。 */
const closingOf = (source: string, span: Span, marker: string): number | undefined => {
  if (source.startsWith(marker, span.end)) return span.end;
  const stop = STOP.exec(source.slice(span.start, span.end))?.[0];
  const before = stop === undefined ? -1 : span.end - stop.length - marker.length;
  return before > span.start && source.startsWith(marker, before) ? before : undefined;
};

/** 文全体を一つの太字が包むなら、太字と文の後ろの位置。途中で閉じる太字（**a** と **b。**）は包んでいない。 */
const closedAt = (source: string, span: Span, marker: string): number | undefined => {
  const closing = closingOf(source, span, marker);
  if (closing === undefined || source.slice(span.start, closing).includes(marker)) return undefined;
  return Math.max(closing + marker.length, span.end);
};

/** 行の頭が段落の頭か。箇条の印のある行は項目の頭。折り返した段落の続きの行（前の行に文がある）は頭ではない。 */
const opensBlock = (source: string, lineStart: number, item: boolean): boolean => {
  if (item || lineStart === 0) return true;
  return BLOCK_BEFORE.test(source.slice(source.lastIndexOf("\n", lineStart - 2) + 1, lineStart - 1));
};

/**
 * 行の頭の太字だけでできた文で、同じ行に続きがあるもの（「- **速く書ける。** 細かな文法を覚えなくても書けます。」の「速く書ける。」）。
 * 項目や段落の札で、見出しと同じく本文の文ではない。太字だけの行（「**注意してください。**」）は札ではなく文。
 */
export const isRunInLabel = (source: string, span: Span): boolean => {
  const line = lineAround(source, span.start);
  const opening = openingOf(source.slice(line.start, span.start));
  if (opening === undefined || !opensBlock(source, line.start, opening.item)) return false;
  const after = closedAt(source, span, opening.marker);
  return after !== undefined && after <= line.end && /\S/u.test(source.slice(after, line.end));
};
