/** Markdown の箇条の印（- * + と 1. 1)）。印のあとに空白が要る。「**賃料**」の太字や「-5」は印ではない。 */
const LIST_MARKER = /^([ \t]*)(?:[-*+]|\d{1,9}[.)])[ \t]+/gmu;

/**
 * 内容から種類を選ぶ行を読むために、行頭の箇条の印を外す。字下げは残す。
 * 「- 賃料：85,000円」も「賃料：85,000円」と同じ項目の行として数えるため。
 */
export const withoutListMarkers = (source: string): string => source.replace(LIST_MARKER, "$1");
