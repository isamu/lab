// The self-written multi-file samples of test/fixtures/bench/sites/<lang>/: a toy docs site in each language, for the rules
// that compare the files of one run. A site is checked as one run, the way `chaff <folder>` checks a folder.
import { existsSync, globSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { BENCH } from "./bench-samples.ts";
import { runFindings, type CorpusFinding } from "./corpus-findings.ts";

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

/** Every rule's findings on the site's files as one run, by path. */
export const siteFindings = (site: Site, files: ReadonlyMap<string, string> = site.files): Promise<Map<string, CorpusFinding[]>> =>
  runFindings(files, site.language, site.genre);
