import { dirname, extname, join, normalize, sep } from "node:path";
import type { CrossDetector, DocumentFinding, MarkupLink, ProseDocument } from "../plugin.ts";
import { anchorsOf, reachesAnchor } from "./broken-link.ts";
import { findingAt, markupOf, quoteOf } from "./markup-finding.ts";

// A relative link from one file of a run to another (`[Fees](./pricing.md#monthly-fee)`) whose file is not in the run,
// or whose heading is not in that file. A link to a URL, to a site-absolute path, or within the page is not this rule's.

const SCHEME = /^[a-z][a-z0-9+.-]*:/iu;
const MARKDOWN = [".md", ".markdown", ".mdx"];
/** The page a folder link opens, as docs sites and code hosts serve it. */
const FOLDER_PAGES = ["index.md", "index.mdx", "README.md"];

/** A link's file part, resolved against the linking file's folder, and its fragment (without #). */
export type LinkTarget = { readonly file: string; readonly folder: boolean; readonly fragment: string | undefined };

const decoded = (text: string): string => {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
};

/**
 * Where a destination leads, from the file at `from`. undefined when it is not a relative link to a page: a URL, a path
 * from the site's root, a link within the page, or a file that is not Markdown (an image, a script).
 */
export const linkTarget = (from: string, destination: string): LinkTarget | undefined => {
  const written = destination.trim();
  if (written === "" || written.startsWith("#") || written.startsWith("/") || written.startsWith("\\") || SCHEME.test(written)) return undefined;
  const hashAt = written.indexOf("#");
  const pathPart = decoded((hashAt === -1 ? written : written.slice(0, hashAt)).split("?")[0] ?? "");
  const extension = extname(pathPart).toLowerCase();
  if (extension !== "" && !MARKDOWN.includes(extension)) return undefined;
  const fragment = hashAt === -1 ? undefined : decoded(written.slice(hashAt + 1));
  return { file: normalize(join(dirname(from), pathPart)), folder: pathPart.endsWith("/") || pathPart === "", fragment };
};

/** The paths a target may name: itself with an extension, a page of that name, or the page a folder opens. */
const candidatesOf = (target: LinkTarget): string[] => {
  if (extname(target.file) !== "") return [target.file];
  return [...MARKDOWN.map((extension) => `${target.file}${extension}`), ...FOLDER_PAGES.map((page) => join(target.file, page))];
};

/** The run's files by normalized path, and the folders they sit in. */
type Run = { readonly byPath: ReadonlyMap<string, ProseDocument>; readonly folders: ReadonlySet<string> };

const runOf = (docs: readonly ProseDocument[]): Run => ({
  byPath: new Map(docs.map((doc) => [normalize(doc.path), doc])),
  folders: new Set(docs.map((doc) => normalize(dirname(doc.path)))),
});

/** Whether a missing target is one the run would hold: in a folder the run's files are in, and not a folder the run has files under. */
const runCovers = (target: LinkTarget, run: Run): boolean => {
  if (target.folder || !run.folders.has(normalize(dirname(target.file)))) return false;
  const under = `${target.file}${sep}`;
  return ![...run.byPath.keys()].some((path) => path.startsWith(under));
};

const findingOf = (doc: ProseDocument, link: MarkupLink, variant: "file" | "anchor"): DocumentFinding => ({
  path: doc.path,
  finding: findingAt(doc, link, { link: quoteOf(doc.source, link), target: link.destination.trim() }, variant),
});

const brokenIn = (doc: ProseDocument, link: MarkupLink, run: Run): DocumentFinding | undefined => {
  const target = linkTarget(doc.path, link.destination);
  if (target === undefined) return undefined;
  const found = candidatesOf(target)
    .map((path) => run.byPath.get(path))
    .find((candidate) => candidate !== undefined);
  if (found === undefined) return runCovers(target, run) ? findingOf(doc, link, "file") : undefined;
  const markup = markupOf(found);
  if (target.fragment === undefined || target.fragment === "" || markup === undefined) return undefined;
  return reachesAnchor(`#${target.fragment}`, anchorsOf(markup)) ? undefined : findingOf(doc, link, "anchor");
};

/** Relative links between the run's Markdown files that lead to a file the run does not have, or to a heading its file does not have. */
export const crossDocBrokenLink: CrossDetector = (docs) => {
  const run = runOf(docs);
  return docs.flatMap((doc) => (markupOf(doc)?.links ?? []).flatMap((link) => brokenIn(doc, link, run) ?? []));
};
