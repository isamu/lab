import { loadAdapter } from "../adapter-load.ts";
import { buildDocument, teamRules } from "../document.ts";
import { profileFor } from "../profile/for-file.ts";
import { resolveGenre } from "../resolve-genre.ts";
import type { Config } from "../config/load.ts";
import type { ProseDocument, StructurePatterns } from "../plugin.ts";
import { readSource, treeLanguage, type TreeContext } from "./tree.ts";

/** One document as lint reads it, and its language package's structure reader. */
export type ReadDocument = { readonly doc: ProseDocument; readonly language: string; readonly structure: StructurePatterns | undefined };

/** One text as lint reads it. `pos` loads the part-of-speech tagger, which costs time, so only a command that reads names asks for it. */
export const documentFromSource = async (
  path: string,
  source: string,
  choice: { readonly language: string; readonly genre: string },
  config: Config,
  pos: boolean,
): Promise<ReadDocument> => {
  const adapter = await loadAdapter(choice.language);
  await adapter.prepare?.({ pos });
  const doc = buildDocument(path, source, adapter, teamRules(config), profileFor(config, path, source, choice.language, choice.genre));
  return { doc, language: choice.language, structure: adapter.structure };
};

/** Reads one file as lint does: its language, genre, document profile and the team's rules. */
export const readDocument = async (path: string, argv: readonly string[], context: TreeContext, pos: boolean): Promise<ReadDocument | undefined> => {
  const source = await readSource(path, context);
  if (source === undefined) return undefined;
  const language = treeLanguage(path, source, argv, context);
  const genre = resolveGenre(path, source, context.config, context.flag(argv, "--genre")).genre;
  return documentFromSource(path, source, { language, genre }, context.config, pos);
};
