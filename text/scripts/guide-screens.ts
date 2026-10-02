// Runs chaff's command line for every guide-page screen that writes "{not-run}" in place of the list of rules that did
// not run, and keeps that list as chaff prints it now. The site puts it in at build (site/src/lib/notRunLists.ts), so a
// new rule changes no guide page. A screen reads the page's ```markdown file=<name> block, or else
// site/src/screens/<lang>/<name> for a document the page does not show.
//   node scripts/guide-screens.ts <out.json>
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { notRunBlock, screensIn, type Screen } from "./guide-screens-parse.ts";
import { runCli } from "../test/cli-run.ts";

const SITE = join(import.meta.dirname, "..", "site", "src");
const GUIDE = join(SITE, "content", "guide");
const SCREEN_DOCUMENTS = join(SITE, "screens");
const LOCALES: Readonly<Record<string, string>> = { ja: "ja_JP.UTF-8", en: "en_US.UTF-8" };

/** page ("ja/getting-started.md") → command → the list as chaff prints it. */
type GuideScreens = Record<string, Record<string, string>>;

const documentFor = (language: string, name: string, documents: Readonly<Record<string, string>>): string => {
  const inPage = documents[name];
  if (inPage !== undefined) return inPage;
  const path = join(SCREEN_DOCUMENTS, language, name);
  if (!existsSync(path)) throw new Error(`guide-screens: ${language}: no \`\`\`markdown file=${name} block on the page, and no ${path}`);
  return readFileSync(path, "utf8");
};

const listFor = async (page: string, language: string, documents: Readonly<Record<string, string>>, screen: Screen): Promise<string> => {
  const [file = ""] = screen.args;
  const run = await runCli({ [file]: documentFor(language, file, documents) }, screen.args, LOCALES[language]);
  rmSync(run.dir, { recursive: true, force: true });
  const block = notRunBlock(run.out);
  if (block === undefined) throw new Error(`guide-screens: ${page}: "${screen.command}" printed no list of rules that did not run`);
  return block;
};

const screensOfPage = async (language: string, file: string): Promise<[string, Record<string, string>]> => {
  const page = `${language}/${file}`;
  const { documents, screens } = screensIn(readFileSync(join(GUIDE, page), "utf8"));
  // One at a time: the command line runs in the document's directory, and the working directory is the process's.
  const lists = await screens.reduce<Promise<Record<string, string>>>(
    async (done, screen) => ({ ...(await done), [screen.command]: await listFor(page, language, documents, screen) }),
    Promise.resolve({}),
  );
  return [page, lists];
};

const pagesOf = (language: string): string[] => readdirSync(join(GUIDE, language)).filter((file) => file.endsWith(".md") && file !== "STYLE.md");

/** Every guide page's screens, one command-line run per screen. */
const guideScreens = async (): Promise<GuideScreens> => {
  const pages = Object.keys(LOCALES).flatMap((language) => pagesOf(language).map((file) => ({ language, file })));
  const entries = await pages.reduce<Promise<[string, Record<string, string>][]>>(
    async (done, { language, file }) => [...(await done), await screensOfPage(language, file)],
    Promise.resolve([]),
  );
  return Object.fromEntries(entries.filter(([, lists]) => Object.keys(lists).length > 0));
};

if (import.meta.main) {
  const out = process.argv[2];
  if (out === undefined) throw new Error("usage: node scripts/guide-screens.ts <out.json>");
  const screens = await guideScreens();
  mkdirSync(dirname(resolve(out)), { recursive: true });
  writeFileSync(resolve(out), `${JSON.stringify(screens, null, 2)}\n`, "utf8");
}
