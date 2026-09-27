import { markdownOutline } from "../document.ts";
import type { StructureNode, StructurePatterns } from "../plugin.ts";
import { buildTree, NO_OUTLINE } from "./build.ts";

export type SourceInput = { readonly path: string; readonly source: string; readonly language: string; readonly markdown: boolean };

/**
 * 文字列から木を作る。Markdown なら見出しとコードの範囲を先に取る。
 * lint は文書モデルを作るときの解析を使い回すので、ここを通らずに buildTree を呼ぶ。
 */
export const buildStructure = (input: SourceInput, patterns: StructurePatterns): StructureNode =>
  buildTree(
    { path: input.path, source: input.source, language: input.language, outline: input.markdown ? markdownOutline(input.source) : NO_OUTLINE },
    patterns,
  );
