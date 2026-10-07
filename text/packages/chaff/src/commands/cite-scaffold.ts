import { documentQuotesWithoutSource } from "../detectors/quote-without-source.ts";
import type { ProseDocument } from "../plugin.ts";
import { readDocument } from "./read-document.ts";
import type { TreeContext } from "./tree.ts";

/** One entry of the claims file the writer fills in: the source the words come from, and where in it (empty: anywhere). */
export type ScaffoldClaim = { readonly source: string; readonly address: string; readonly quote: string };

/**
 * The quotations quote-without-source finds in a document, as cite's claims with the source and address left for the
 * writer. The rule's genre and level do not apply: asking for a scaffold is asking for every such quotation.
 */
export const scaffoldClaims = (doc: ProseDocument): ScaffoldClaim[] =>
  documentQuotesWithoutSource(doc).map((found) => ({ source: "", address: "", quote: found.quote }));

/** Prints the claims file for one document. The writer fills in each source and runs `chaff cite <claims.json>`. */
export const runScaffold = async (targets: readonly string[], argv: readonly string[], context: TreeContext, usage: string): Promise<number> => {
  const [path] = targets;
  if (path === undefined || targets.length !== 1) {
    console.error(usage);
    return 1;
  }
  const read = await readDocument(path, argv, context, false);
  if (read === undefined) return 1;
  console.log(JSON.stringify(scaffoldClaims(read.doc), null, 2));
  return 0;
};
