import { markdownOutline } from "../document.ts";
import type { DocumentProfile, StructureNode, StructurePatterns } from "../plugin.ts";
import { buildTree } from "./build.ts";
import { textOutline } from "../page-furniture.ts";

export type SourceInput = {
  readonly path: string;
  readonly source: string;
  readonly language: string;
  readonly markdown: boolean;
  readonly profile?: DocumentProfile | undefined;
};

/**
 * 文字列から木を作る。Markdown なら見出しとコードの範囲を先に取る。
 * lint は文書モデルを作るときの解析を使い回すので、ここを通らずに buildTree を呼ぶ。
 */
export const buildStructure = (input: SourceInput, patterns: StructurePatterns): StructureNode =>
  buildTree(
    {
      path: input.path,
      source: input.source,
      language: input.language,
      outline: input.markdown ? markdownOutline(input.source) : textOutline(input.source),
      markdown: input.markdown,
      profile: input.profile,
    },
    patterns,
  );
