import { markdownOutline } from "../document.ts";
import type { DocumentProfile, Lexicon, StructureNode, StructurePatterns } from "../plugin.ts";
import { buildTree, type Outline } from "./build.ts";
import { textOutline } from "../page-furniture.ts";
import { emailParts, emailVocabulary } from "../email-parts.ts";

export type SourceInput = {
  readonly path: string;
  readonly source: string;
  readonly language: string;
  readonly markdown: boolean;
  readonly profile?: DocumentProfile | undefined;
  /** 言語パッケージの語彙表。メールの引用した返信を見分けて、木に入れない。無ければ見分けない。 */
  readonly lexicons?: Readonly<Record<string, Lexicon>> | undefined;
};

const outlineOf = (input: SourceInput): Outline =>
  input.markdown
    ? markdownOutline(input.source, input.lexicons)
    : textOutline(input.source, emailParts(input.source, emailVocabulary(input.lexicons ?? {})).replyQuotes);

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
      outline: outlineOf(input),
      markdown: input.markdown,
      profile: input.profile,
    },
    patterns,
  );
