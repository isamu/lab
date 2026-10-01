import type { Span } from "./plugin.ts";

/**
 * 行が一つのリンクだけか。前後の空白を除いた行が、どれかのリンクの範囲とちょうど重なる。
 * 記事の一覧のようにリンクを 1 行ずつ並べた段落では、句点が無くても行ごとに一つの項目と読まれる。
 * line と links は source の中の位置。
 */
export const isLinkLine = (source: string, line: Span, links: readonly Span[]): boolean => {
  const text = source.slice(line.start, line.end);
  const start = line.start + text.length - text.trimStart().length;
  const end = line.end - (text.length - text.trimEnd().length);
  return links.some((link) => link.start === start && link.end === end);
};
