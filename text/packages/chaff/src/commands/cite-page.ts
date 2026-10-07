import { fetchPage, type Fetcher } from "../html/fetch-page.ts";
import { pageDocument } from "../html/page-document.ts";
import { resolveGenre } from "../resolve-genre.ts";
import { treeFromSource, treeLanguage, type SourceTree, type TreeContext } from "./tree.ts";
import type { Texts } from "../ui.ts";

/** A source on the web: read once, then checked like a file. The network is reached only through fetchPage. */
export type CiteContext = TreeContext & {
  /** What fetches a page. Tests pass a stand-in; the command line never does. */
  readonly fetcher?: Fetcher;
};

/** Long enough for a slow page, short enough that a dead host does not hold up a run of checks. */
const PAGE_TIMEOUT_MS = 30_000;

/** Far beyond any article or statute page; a log or a dump served as text is refused instead of read whole. */
const MAX_PAGE_BYTES = 20 * 1024 * 1024;

const WEB = /^https?:\/\//iu;

export const isWebSource = (source: string): boolean => WEB.test(source);

const TEXT: Texts<{
  readonly unfetched: (why: string) => string;
  readonly unsupported: (url: string, type: string) => string;
  readonly noStructure: (url: string, language: string) => string;
}> = {
  ja: {
    unfetched: (why) => `ページを取得できませんでした: ${why}`,
    unsupported: (url, type) => `${url}: ${type} は文字の文書として読めません（HTML、Markdown、テキストのページを渡してください）`,
    noStructure: (url, language) => `${url}: 言語 ${language} のパッケージは文書の構造を読めません（structure がありません）`,
  },
  en: {
    unfetched: (why) => `Could not fetch the page: ${why}`,
    unsupported: (url, type) => `${url}: ${type} cannot be read as a text document (give an HTML, Markdown or plain-text page)`,
    noStructure: (url, language) => `${url}: the ${language} package cannot read a document's structure (it has no structure)`,
  },
};

/**
 * A web page as a tree, read as `chaff tree` reads a file: HTML becomes Markdown first, so its headings are addresses.
 * Once fetched, the same page gives the same tree. undefined, after saying why, when it cannot be fetched or read.
 */
export const readPageTree = async (url: string, argv: readonly string[], context: CiteContext): Promise<SourceTree | undefined> => {
  const text = TEXT[context.ui ?? "ja"];
  const fetched = await fetchPage(url, { timeout_ms: PAGE_TIMEOUT_MS, max_bytes: MAX_PAGE_BYTES }, context.fetcher).catch((err: unknown) => {
    console.error(text.unfetched(err instanceof Error ? err.message : String(err)));
    return undefined;
  });
  if (fetched === undefined) return undefined;
  const page = pageDocument(fetched.contentType, fetched.text);
  if ("unsupported" in page) {
    console.error(text.unsupported(url, page.unsupported));
    return undefined;
  }
  const language = treeLanguage(page.path, page.text, argv, context);
  const genre = resolveGenre(page.path, page.text, context.config, context.flag(argv, "--genre")).genre;
  const tree = await treeFromSource(page.path, page.text, language, genre, context.config);
  if (tree === undefined) console.error(text.noStructure(url, language));
  return tree === undefined ? undefined : { source: page.text, tree };
};
