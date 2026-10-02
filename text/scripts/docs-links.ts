// Checks the links of the built site (text/site/dist) and of the READMEs. Fails on a link to a page or anchor that
// does not exist, a guide page nothing links to, and a guide page whose Japanese and English link to different pages.
//   node scripts/docs-links.ts site/dist            (yarn docs:links in text/site, after its build)
//   node scripts/docs-links.ts site/dist --graph    also prints, per guide page, the guide pages linking in and out
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { brokenLinks, mirrorGaps, orphanGuidePages, pageOf, pagesLinked, type LinkProblem, type SitePage } from "./site-links.ts";

const SITE_ORIGIN = "https://isamu.github.io";
const BASE = "/lab/";
const LANGS = ["ja", "en"] as const;
const TEXT_ROOT = resolve(import.meta.dirname, "..");
const READMES = ["README.md", "packages/chaff/README.md", "packages/lang-ja/README.md", "packages/lang-en/README.md"];
const MARKDOWN_LINK = /\]\(([^)\s]+)(?:\s+"[^"]*")?\)/gu;
const CODE = /(?:^(```|~~~)[\s\S]*?^\1)|(?:`[^`\n]*`)/gmu;
// The site's own menus link every page; what a page's text links to is read without them.
const MENUS = /<head>[\s\S]*?<\/head>|<header[\s\S]*?<\/header>|<nav[\s\S]*?<\/nav>/gu;

const htmlFiles = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return htmlFiles(path);
    return entry.name === "index.html" ? [path] : [];
  });

const servedPath = (dist: string, file: string): string => {
  const folder = relative(dist, dirname(file)).split(sep).join("/");
  return folder === "" ? BASE : `${BASE}${folder}/`;
};

const readSite = (dist: string): { whole: SitePage[]; text: SitePage[] } => {
  const files = htmlFiles(dist).map((file) => ({ path: servedPath(dist, file), html: readFileSync(file, "utf8") }));
  return {
    whole: files.map(({ path, html }) => pageOf(path, html)),
    text: files.map(({ path, html }) => pageOf(path, html.replaceAll(MENUS, ""))),
  };
};

const isLocal = (href: string): boolean => !/^[a-z][a-z0-9+.-]*:/iu.test(href) && !href.startsWith("#");

/** A README's links to the site are checked like the site's own; its links to files must reach a file. */
const readmeProblems = (pages: readonly SitePage[]): LinkProblem[] =>
  READMES.filter((readme) => existsSync(join(TEXT_ROOT, readme))).flatMap((readme) => {
    const body = readFileSync(join(TEXT_ROOT, readme), "utf8").replaceAll(CODE, "");
    const hrefs = [...body.matchAll(MARKDOWN_LINK)].map((match) => match[1] ?? "");
    const asPage: SitePage = { path: `/readme/${readme}/`, ids: new Set(), hrefs: hrefs.filter((href) => href.startsWith(`${SITE_ORIGIN}${BASE}`)) };
    const toSite = brokenLinks([...pages, asPage], SITE_ORIGIN).filter((problem) => problem.page === asPage.path);
    const toFiles = hrefs
      .filter(isLocal)
      .filter((href) => !existsSync(resolve(TEXT_ROOT, dirname(readme), decodeURIComponent(href.split("#")[0] ?? ""))))
      .map((href): LinkProblem => ({ page: readme, detail: `${href}: no such file` }));
    return [...toSite.map((problem) => ({ ...problem, page: readme })), ...toFiles];
  });

const printGraph = (pages: readonly SitePage[]): void => {
  const guide = pages.filter((page) => page.path.includes("/guide/")).sort((a, b) => a.path.localeCompare(b.path));
  const linked = new Map(guide.map((page) => [page.path, [...pagesLinked(page, SITE_ORIGIN)].filter((path) => path.includes("/guide/"))]));
  guide.forEach((page) => {
    const inbound = guide.filter((other) => linked.get(other.path)?.includes(page.path)).length;
    console.log(`${page.path}  in ${inbound}  out ${linked.get(page.path)?.length ?? 0}`);
  });
};

const main = (): void => {
  const dist = resolve(process.argv[2] ?? "site/dist");
  if (!existsSync(join(dist, "index.html"))) throw new Error(`${dist}: no built site here; run the site's build first`);
  const site = readSite(dist);
  if (process.argv.includes("--graph")) printGraph(site.text);
  const problems = [
    ...brokenLinks(site.whole, SITE_ORIGIN),
    ...readmeProblems(site.whole),
    ...orphanGuidePages(site.text, SITE_ORIGIN),
    ...mirrorGaps(site.text, SITE_ORIGIN, LANGS),
  ];
  problems.forEach((problem) => console.error(`${problem.page}: ${problem.detail}`));
  console.log(`${site.whole.length} pages checked, ${problems.length} link problems`);
  if (problems.length > 0) process.exitCode = 1;
};

main();
