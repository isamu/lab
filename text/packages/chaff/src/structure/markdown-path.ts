import { extname } from "node:path";

const MARKDOWN = [".md", ".markdown", ".mdx"];

/** 見出しとコードの範囲を Markdown として読むか。.txt の契約書は行頭の番号だけで木にする。 */
export const isMarkdownPath = (path: string): boolean => MARKDOWN.includes(extname(path).toLowerCase());
