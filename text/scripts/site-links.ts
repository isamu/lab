// Pure: the links of the built site, checked against the site itself. A page is known by its path under the
// site's base (`/lab/ja/guide/commands/`). Three kinds of problem:
//   a link no page answers, or whose anchor the page does not have;
//   a guide page no other page's text links to (the menus do not count: a reader has to be sent there);
//   a guide page whose two languages link to different pages, or that exists in one language only.

export type SitePage = {
  /** Where the page is served, under the base, with a trailing slash (`/lab/ja/guide/commands/`). */
  readonly path: string;
  readonly ids: ReadonlySet<string>;
  readonly hrefs: readonly string[];
};

export type LinkProblem = { readonly page: string; readonly detail: string };

const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/iu;
const FILE = /\.[a-z0-9]+$/iu;

const decode = (text: string): string => {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
};

/** The page path and anchor a link points at, or undefined for a link off the site or to a file rather than a page. */
export const linkTarget = (from: string, href: string, siteOrigin: string): { path: string; anchor: string } | undefined => {
  const local = href.startsWith(siteOrigin) ? href.slice(siteOrigin.length) : href;
  if (EXTERNAL.test(local)) return undefined;
  const url = new URL(local, `http://site${from}`);
  if (FILE.test(url.pathname)) return undefined;
  const path = url.pathname.endsWith("/") ? url.pathname : `${url.pathname}/`;
  return { path: decode(path), anchor: decode(url.hash.slice(1)) };
};

/** Every link that no page answers, or that names an anchor its page does not have. */
export const brokenLinks = (pages: readonly SitePage[], siteOrigin: string): LinkProblem[] => {
  const byPath = new Map(pages.map((page) => [page.path, page]));
  return pages.flatMap((page) =>
    page.hrefs.flatMap((href): LinkProblem[] => {
      const target = linkTarget(page.path, href, siteOrigin);
      if (target === undefined) return [];
      const answer = byPath.get(target.path);
      if (answer === undefined) return [{ page: page.path, detail: `${href}: no such page` }];
      if (target.anchor !== "" && !answer.ids.has(target.anchor)) return [{ page: page.path, detail: `${href}: no such anchor` }];
      return [];
    }),
  );
};

/** The other pages a page's links reach, without anchors. */
export const pagesLinked = (page: SitePage, siteOrigin: string): Set<string> =>
  new Set(
    page.hrefs.flatMap((href) => {
      const target = linkTarget(page.path, href, siteOrigin);
      return target === undefined || target.path === page.path ? [] : [target.path];
    }),
  );

const isGuidePage = (path: string): boolean => /^\/[^/]+\/[a-z]+\/guide\/[^/]+\/$/u.test(path);

/** Guide pages that no other page links to. `pages` are read without their menus. */
export const orphanGuidePages = (pages: readonly SitePage[], siteOrigin: string): LinkProblem[] => {
  const linkedTo = new Set(pages.flatMap((page) => [...pagesLinked(page, siteOrigin)]));
  return pages
    .filter((page) => isGuidePage(page.path) && !linkedTo.has(page.path))
    .map((page) => ({ page: page.path, detail: "no page links here (apart from the menus)" }));
};

const inLanguage = (path: string, from: string, to: string): string => path.replace(`/${from}/`, `/${to}/`);

/** Guide pages whose languages differ: one language only, or links to different pages. `pages` are read without menus. */
export const mirrorGaps = (pages: readonly SitePage[], siteOrigin: string, langs: readonly [string, string]): LinkProblem[] => {
  const [first, second] = langs;
  const byPath = new Map(pages.map((page) => [page.path, page]));
  const guide = pages.filter((page) => isGuidePage(page.path));
  const missing = guide.flatMap((page): LinkProblem[] => {
    const lang = page.path.split("/")[2] ?? "";
    const other = lang === first ? second : first;
    return byPath.has(inLanguage(page.path, lang, other)) ? [] : [{ page: page.path, detail: `no ${other} page` }];
  });
  const differing = guide
    .filter((page) => page.path.split("/")[2] === first)
    .flatMap((page): LinkProblem[] => {
      const counterpart = byPath.get(inLanguage(page.path, first, second));
      if (counterpart === undefined) return [];
      const ours = new Set([...pagesLinked(page, siteOrigin)].map((path) => inLanguage(path, first, second)));
      const theirs = pagesLinked(counterpart, siteOrigin);
      const onlyOurs = [...ours].filter((path) => !theirs.has(path));
      const onlyTheirs = [...theirs].filter((path) => !ours.has(path));
      return [
        ...onlyOurs.map((path) => ({ page: page.path, detail: `links to ${inLanguage(path, second, first)}; the ${second} page does not` })),
        ...onlyTheirs.map((path) => ({ page: counterpart.path, detail: `links to ${path}; the ${first} page does not` })),
      ];
    });
  return [...missing, ...differing];
};

const attributes = (html: string, name: string): string[] =>
  [...html.matchAll(new RegExp(`\\s${name}="([^"]*)"`, "gu"))].map((match) => (match[1] ?? "").replaceAll("&amp;", "&"));

/** A built page's anchors and links, read from its HTML. Astro writes every attribute in double quotes. */
export const pageOf = (path: string, html: string): SitePage => ({
  path,
  ids: new Set([...attributes(html, "id"), ...attributes(html, "name")].map(decode)),
  hrefs: attributes(html, "href"),
});
