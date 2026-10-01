import { uiLanguageOf } from "../ui.ts";
import { outlineOf } from "../outline/shape.ts";
import { renderOutlineCompact, renderOutlineFriendly, renderOutlineJson, type DocumentOutline } from "../outline/render.ts";
import { OUTLINE_TEXT } from "../outline/text.ts";
import { readDocument } from "./read-document.ts";
import type { TreeContext } from "./tree.ts";

/** Options whose value is the next argument. That value is not a file. */
const VALUED: ReadonlySet<string> = new Set(["--language", "--genre"]);

export const outlineTargets = (argv: readonly string[]): string[] =>
  argv.slice(1).filter((arg, index, all) => !arg.startsWith("--") && !VALUED.has(all[index - 1] ?? ""));

const MOST_FILES = 2;

const readOutline = async (path: string, argv: readonly string[], context: TreeContext): Promise<DocumentOutline | undefined> => {
  const prose = await readDocument(path, argv, context, false);
  return prose === undefined ? undefined : { path, language: prose.language, outline: outlineOf(prose.doc) };
};

/** The files in the order given, or undefined once one cannot be read (its error is already printed). */
const readAll = async (paths: readonly string[], argv: readonly string[], context: TreeContext): Promise<DocumentOutline[] | undefined> =>
  paths.reduce<Promise<DocumentOutline[] | undefined>>(async (previous, path) => {
    const earlier = await previous;
    if (earlier === undefined) return undefined;
    const next = await readOutline(path, argv, context);
    return next === undefined ? undefined : [...earlier, next];
  }, Promise.resolve([]));

const renderFor = (argv: readonly string[], documents: readonly DocumentOutline[]): string => {
  const text = OUTLINE_TEXT[uiLanguageOf(documents[0]?.language)];
  if (argv.includes("--json")) return renderOutlineJson(documents);
  return argv.includes("--compact") ? renderOutlineCompact(documents, text) : renderOutlineFriendly(documents, text);
};

/**
 * A document's outline and shape (headings, average section length, text in lists, bold), or two documents' side by
 * side: a restructure measured by machine. Measures; never judges, so it always ends with 0 once the files are read.
 */
export const runOutline = async (targets: readonly string[], argv: readonly string[], context: TreeContext): Promise<number> => {
  if (targets.length === 0 || targets.length > MOST_FILES) {
    console.error(OUTLINE_TEXT[context.ui ?? "ja"].usage);
    return 1;
  }
  const documents = await readAll(targets, argv, context);
  if (documents === undefined) return 1;
  console.log(renderFor(argv, documents));
  return 0;
};
