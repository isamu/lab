import { readMarkdown } from "../markdown-read.ts";
import { isMarkdownPath } from "../structure/markdown-path.ts";
import { uiLanguageOf } from "../ui.ts";
import { ATOM_KINDS, isAtomKind, type AtomKind } from "../compare/atom.ts";
import { extractFacts } from "../compare/extract.ts";
import { outcomeOf, type Allowed, type Compared } from "../compare/outcome.ts";
import { renderCompact, renderFriendly, renderJson } from "../compare/render.ts";
import { COMPARE_TEXT } from "../compare/text.ts";
import { readDocument } from "./read-document.ts";
import type { TreeContext } from "./tree.ts";

/** Options whose value is the next argument. That value is not a file. */
const VALUED: ReadonlySet<string> = new Set(["--language", "--genre", "--allow-dropped", "--allow-added"]);

export const compareTargets = (argv: readonly string[]): string[] =>
  argv.slice(1).filter((arg, index, all) => !arg.startsWith("--") && !VALUED.has(all[index - 1] ?? ""));

/** Every value given to a repeatable option, split at commas: `--allow-dropped url,code --allow-dropped quote`. */
const optionValues = (argv: readonly string[], name: string): string[] =>
  argv.flatMap((arg, index) => (arg === name ? (argv[index + 1] ?? "").split(",") : [])).filter((value) => value !== "");

type ParsedAllowed = { readonly allowed: Allowed } | { readonly unknown: string };

/** The kinds allowed to be dropped and added, or the first word that is not a kind. */
const parseAllowed = (argv: readonly string[]): ParsedAllowed => {
  const dropped = optionValues(argv, "--allow-dropped");
  const added = optionValues(argv, "--allow-added");
  const unknown = [...dropped, ...added].find((kind) => !isAtomKind(kind));
  if (unknown !== undefined) return { unknown };
  const kinds = (values: readonly string[]): Set<AtomKind> => new Set(values.filter(isAtomKind));
  return { allowed: { dropped: kinds(dropped), added: kinds(added) } };
};

export type DocumentFacts = Compared & { readonly language: string };

/** One document's facts, read as lint reads it: its language, the team's names, and the parts of speech. */
export const readFacts = async (path: string, argv: readonly string[], context: TreeContext): Promise<DocumentFacts | undefined> => {
  const prose = await readDocument(path, argv, context, true);
  if (prose === undefined) return undefined;
  const root = isMarkdownPath(path) ? readMarkdown(prose.doc.source).root : undefined;
  const extraction = extractFacts({ doc: prose.doc, root, structure: prose.structure, names: context.config.names ?? [] });
  return { path, extraction, language: prose.language };
};

const renderFor = (argv: readonly string[]): typeof renderFriendly => {
  if (argv.includes("--json")) return (outcome) => renderJson(outcome);
  return argv.includes("--compact") ? renderCompact : renderFriendly;
};

/**
 * Whether a rewrite kept every fact: numbers, dates, URLs, code, names, quotations, headings, references and footnotes.
 * Compares; never rewrites. Ends with 1 when a fact was dropped or added, so a rewrite can be checked like a test.
 */
export const runCompare = async (targets: readonly string[], argv: readonly string[], context: TreeContext): Promise<number> => {
  const host = COMPARE_TEXT[context.ui ?? "ja"];
  const [beforePath, afterPath] = targets;
  if (beforePath === undefined || afterPath === undefined || targets.length !== 2) {
    console.error(host.usage);
    return 1;
  }
  const parsed = parseAllowed(argv);
  if ("unknown" in parsed) {
    console.error(host.unknownKind(parsed.unknown, ATOM_KINDS.join(", ")));
    return 1;
  }
  const before = await readFacts(beforePath, argv, context);
  const after = before === undefined ? undefined : await readFacts(afterPath, argv, context);
  if (before === undefined || after === undefined) return 1;
  const outcome = outcomeOf(before, after, parsed.allowed);
  console.log(renderFor(argv)(outcome, COMPARE_TEXT[uiLanguageOf(before.language)]));
  return outcome.ok ? 0 : 1;
};
