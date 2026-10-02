// The self-written multi-file samples of test/fixtures/bench/sites/<lang>/: a toy docs site in each language, for the rules
// that compare the files of one run. A site is checked as one run, the way `chaff <folder>` checks a folder.
import { existsSync, globSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { BENCH } from "./bench-samples.ts";
import { runFindings, type CorpusFinding } from "./corpus-findings.ts";
import type { Mutation, SitePlant } from "./bench-text.ts";

/** A docs site's genre: the pages of a manual. */
const SITE_GENRE = "docs/manual";

export type Site = { readonly name: string; readonly language: string; readonly genre: string; readonly files: ReadonlyMap<string, string> };

/** The language's site, its files by path (sites/<lang>/…, so relative links resolve between them), in path order. */
export const siteOf = (language: string): Site | undefined => {
  const dir = join(BENCH, "sites", language);
  if (!existsSync(dir)) return undefined;
  const paths = globSync("**/*.md", { cwd: dir }).toSorted((left, right) => left.localeCompare(right, "en"));
  return {
    name: `${language}/site`,
    language,
    genre: SITE_GENRE,
    files: new Map(paths.map((path) => [join("sites", language, path), readFileSync(join(dir, path), "utf8")])),
  };
};

/**
 * Plants a mistake in the site's file named `name` (index.md): every `from` in it becomes `to`. The plant is on the line of
 * the first one. undefined when the file is not there or holds no `from`.
 */
export const rewriteInSite = (files: ReadonlyMap<string, string>, name: string, from: string, to: string): SitePlant | undefined => {
  const path = [...files.keys()].find((key) => basename(key) === name);
  const source = path === undefined ? undefined : files.get(path);
  const at = source?.indexOf(from) ?? -1;
  if (path === undefined || source === undefined || at === -1) return undefined;
  const line = source.slice(0, at).split("\n").length;
  return { files: new Map([...files, [path, source.replaceAll(from, to)]]), path, line };
};

/** A mistake planted only in a site, for a rule that compares the files of one run. */
export const siteMutation = (rule: string, id: string, language: string, site: (files: ReadonlyMap<string, string>) => SitePlant | undefined): Mutation => ({
  id,
  rule,
  languages: [language],
  plant: () => undefined,
  site,
});

/** Every rule's findings on the site's files as one run, by path. */
export const siteFindings = (site: Site, files: ReadonlyMap<string, string> = site.files): Promise<Map<string, CorpusFinding[]>> =>
  runFindings(files, site.language, site.genre);
