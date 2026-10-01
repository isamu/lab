import { loadAdapter } from "../adapter-load.ts";
import { buildDocument, teamRules } from "../document.ts";
import { profileFor } from "../profile/for-file.ts";
import { resolveGenre } from "../resolve-genre.ts";
import type { ProseDocument, StructurePatterns } from "../plugin.ts";
import { readSource, treeLanguage, type TreeContext } from "./tree.ts";

/** One document as lint reads it, and its language package's structure reader. */
export type ReadDocument = { readonly doc: ProseDocument; readonly language: string; readonly structure: StructurePatterns | undefined };

/**
 * Reads one file as lint does: its language, genre, document profile and the team's rules. `pos` loads the
 * part-of-speech tagger, which costs time, so only a command that reads names asks for it.
 */
export const readDocument = async (path: string, argv: readonly string[], context: TreeContext, pos: boolean): Promise<ReadDocument | undefined> => {
  const source = await readSource(path, context);
  if (source === undefined) return undefined;
  const language = treeLanguage(path, source, argv, context);
  const adapter = await loadAdapter(language);
  await adapter.prepare?.({ pos });
  const genre = resolveGenre(path, source, context.config, context.flag(argv, "--genre")).genre;
  const doc = buildDocument(path, source, adapter, teamRules(context.config), profileFor(context.config, path, source, language, genre));
  return { doc, language, structure: adapter.structure };
};
