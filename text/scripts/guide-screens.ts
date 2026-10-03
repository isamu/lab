// Runs chaff's command line for the guide pages' screens. With an output path, it runs every screen that keeps a
// "{not-run}" or "{counts}" line and writes what chaff printed there, for the site to fill in at build
// (site/src/lib/screenFills.ts), so a new rule changes no guide page. test/test_guide_screen_output.ts runs every screen
// and compares it with the page. Where a screen's documents come from is in scripts/guide-screens-parse.ts.
//   node scripts/guide-screens.ts <out.json>
//   node scripts/guide-screens.ts --check en/commands.md ...   print each screen of these pages that differs from chaff
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { ELISION, asScreen, fillsFor, hasFill, missingFills, screenMatches, screensIn, type Screen } from "./guide-screens-parse.ts";
import { withScreenFills, type PageFills, type ScreenFills } from "../site/src/lib/screenFills.ts";
import { runCli } from "../test/cli-run.ts";

const SITE = join(import.meta.dirname, "..", "site", "src");
const GUIDE = join(SITE, "content", "guide");
const SCREEN_FILES = join(SITE, "screens");
const LOCALES: Readonly<Record<string, string>> = { ja: "ja_JP.UTF-8", en: "en_US.UTF-8" };

/** A guide page: its language and file name ("en", "commands.md"). */
export type GuidePage = { readonly language: string; readonly file: string };

const filesUnder = (dir: string): Record<string, string> => {
  if (!existsSync(dir)) return {};
  const paths = readdirSync(dir, { recursive: true, encoding: "utf8" }).filter((path) => statSync(join(dir, path)).isFile());
  return Object.fromEntries(paths.map((path) => [path.split(sep).join("/"), readFileSync(join(dir, path), "utf8")]));
};

export const pageName = ({ language, file }: GuidePage): string => `${language}/${file}`;

/** The folder of a page's screen files, and of one setup over them. */
export const screenFolder = ({ language, file }: GuidePage, setup?: string): string => {
  const stem = file.replace(/\.md$/u, "");
  return join(SCREEN_FILES, language, setup === undefined ? stem : `${stem}--${setup}`);
};

/** The files a screen runs in: the page's file= blocks, then its screen folder, then the screen's setup folder. */
const filesFor = (page: GuidePage, documents: Readonly<Record<string, string>>, screen: Screen): Record<string, string> => ({
  ...documents,
  ...filesUnder(screenFolder(page)),
  ...(screen.setup === undefined ? {} : filesUnder(screenFolder(page, screen.setup))),
});

const CREDENTIALS = ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_IDENTITY_TOKEN", "ANTHROPIC_IDENTITY_TOKEN_FILE", "OPENAI_API_KEY"];
const NO_PROFILE = join(tmpdir(), "chaff-guide-screens-no-anthropic-profile");

/**
 * Runs with no API key and no `ant auth login` profile in sight: `test --dry-run` says whether it found credentials,
 * and a page shows a reader's first run, without them, whatever the machine running the screens has.
 */
const withoutCredentials = async <T>(run: () => Promise<T>): Promise<T> => {
  const names = [...CREDENTIALS, "ANTHROPIC_CONFIG_DIR"];
  const saved = new Map(names.map((name) => [name, process.env[name]]));
  CREDENTIALS.forEach((name) => {
    delete process.env[name];
  });
  process.env["ANTHROPIC_CONFIG_DIR"] = NO_PROFILE;
  try {
    return await run();
  } finally {
    saved.forEach((value, name) => {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    });
  }
};

/** Chaff's output for one screen, as a page would show it, in a fresh folder holding the screen's files. */
export const runScreen = async (page: GuidePage, documents: Readonly<Record<string, string>>, screen: Screen): Promise<string> => {
  if (screen.setup !== undefined && !existsSync(screenFolder(page, screen.setup)))
    throw new Error(`guide-screens: ${pageName(page)}: "${screen.command}": no folder ${relative(process.cwd(), screenFolder(page, screen.setup))}`);
  const run = await withoutCredentials(() => runCli(filesFor(page, documents, screen), screen.args, LOCALES[page.language]));
  const folders = [realpathSync(run.dir), run.dir];
  rmSync(run.dir, { recursive: true, force: true });
  // The run's folder is a fresh temporary one; a page writes the folder a reader runs in as "…".
  return asScreen(
    screen.command,
    folders.reduce((text, folder) => text.replaceAll(folder, ELISION), run.both),
  );
};

/** Every guide page, both languages. */
export const guidePages = (): GuidePage[] =>
  Object.keys(LOCALES).flatMap((language) =>
    readdirSync(join(GUIDE, language))
      .filter((file) => file.endsWith(".md") && file !== "STYLE.md")
      .map((file) => ({ language, file })),
  );

export const readGuidePage = (page: GuidePage): ReturnType<typeof screensIn> => screensIn(readFileSync(join(GUIDE, page.language, page.file), "utf8"));

/** The lines for a screen's markers; a marker chaff printed nothing for stops here, naming the page and the command. */
const madeFills = (page: GuidePage, screen: Screen, output: string): ScreenFills => {
  const fills = fillsFor(screen.shown, output);
  const missing = missingFills(screen.shown, fills);
  if (missing.length > 0) throw new Error(`guide-screens: ${pageName(page)}: "${screen.command}" printed nothing for ${missing.join(", ")}`);
  return fills;
};

const fillsOfPage = async (page: GuidePage): Promise<[string, PageFills]> => {
  const { documents, screens } = readGuidePage(page);
  // One at a time: the command line runs in the screen's folder, and the working directory is the process's.
  const fills = await screens
    .filter((screen) => hasFill(screen.shown))
    .reduce<Promise<PageFills>>(
      async (done, screen) => [...(await done), { command: screen.command, fills: madeFills(page, screen, await runScreen(page, documents, screen)) }],
      Promise.resolve([]),
    );
  return [pageName(page), fills];
};

/** The lines to fill in for every guide page's marked screens, one command-line run per screen. */
const guideScreenFills = async (): Promise<Record<string, PageFills>> => {
  const entries = await guidePages().reduce<Promise<[string, PageFills][]>>(
    async (done, page) => [...(await done), await fillsOfPage(page)],
    Promise.resolve([]),
  );
  return Object.fromEntries(entries.filter(([, fills]) => fills.length > 0));
};

/** A screen compared with chaff: the page's screen with its markers filled in, what chaff printed, and whether they agree. */
export type ScreenCheck = { readonly shown: string; readonly actual: string; readonly matches: boolean };

const BACKSLASH = /\\/gu;
// On Windows chaff prints paths with \; the pages write them with /.
const asPosix = (output: string): string => (process.platform === "win32" ? output.replace(BACKSLASH, "/") : output);

export const checkScreen = async (page: GuidePage, documents: Readonly<Record<string, string>>, screen: Screen): Promise<ScreenCheck> => {
  const actual = asPosix(await runScreen(page, documents, screen));
  const fills = fillsFor(screen.shown, actual);
  if (missingFills(screen.shown, fills).length > 0) return { shown: screen.shown, actual, matches: false };
  const shown = withScreenFills(screen.shown, fills, `${pageName(page)}: "${screen.command}"`);
  return { shown, actual, matches: screenMatches(shown, actual) };
};

/**
 * The screens no test runs, by page and command, with why. Anything else on a guide page is run and compared with
 * chaff, so a screen that cannot be run is listed here rather than silently left out.
 */
const WATCH = "--watch waits for the file to be saved, and its lines carry the time";
const REAL_ARTICLE = "an excerpt of a real article, which the repository does not keep";
const GRADE_BASELINE =
  "reads a.results.jsonl that the run before it wrote; a kept copy carries the chaff version and the rules' hash, and goes stale with every rule";

export const UNCHECKED: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  "ja/getting-started.md": { "$ npx chaffjs sample.md": REAL_ARTICLE },
  "en/getting-started.md": { "$ npx chaffjs sample.md": REAL_ARTICLE },
  "ja/commands.md": { "$ npx chaffjs article.md --watch": WATCH, "$ npx chaffjs sample.md --compact": REAL_ARTICLE },
  "en/commands.md": {
    "$ npx chaffjs article.md --watch": WATCH,
    "$ npx chaffjs sample.md --compact": REAL_ARTICLE,
    "$ npx chaffjs feedback sample.md --rule heading-echo --line 142": REAL_ARTICLE,
  },
  "ja/ai-evals.md": {
    "$ npx chaffjs grade prompt-a.jsonl --experimental --out a.results.jsonl": GRADE_BASELINE,
    "$ npx chaffjs grade prompt-b.jsonl --baseline a.results.jsonl": GRADE_BASELINE,
  },
  "en/ai-evals.md": {
    "$ npx chaffjs grade prompt-a.jsonl --experimental --out a.results.jsonl": GRADE_BASELINE,
    "$ npx chaffjs grade prompt-b.jsonl --baseline a.results.jsonl": GRADE_BASELINE,
  },
};

const WINDOWS_PATH = "chaff prints a file's path as the OS spells it, docs\\a.md on Windows, where the screen shows docs/a.md";

/** The screens no test runs on Windows only, by page and command, with why. */
export const UNCHECKED_ON_WINDOWS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  "ja/commands.md": { "$ npx chaffjs docs/ --compact": WINDOWS_PATH, "$ npx chaffjs docs/ --show-baseline --compact": WINDOWS_PATH },
  "en/commands.md": { "$ npx chaffjs docs/ --compact": WINDOWS_PATH, "$ npx chaffjs docs/ --show-baseline --compact": WINDOWS_PATH },
};

/** A page's screens that are run and compared with chaff here: every one not listed for this platform. */
export const checkedScreens = (page: GuidePage): { documents: Readonly<Record<string, string>>; screens: Screen[] } => {
  const { documents, screens } = readGuidePage(page);
  const unchecked = { ...UNCHECKED[pageName(page)], ...(process.platform === "win32" ? UNCHECKED_ON_WINDOWS[pageName(page)] : {}) };
  return { documents, screens: screens.filter((screen) => unchecked[screen.command] === undefined) };
};

/** Each checked screen of a page that differs from chaff, with the check. */
export const differingScreens = async (page: GuidePage): Promise<{ screen: Screen; check: ScreenCheck }[]> => {
  const { documents, screens } = checkedScreens(page);
  return screens.reduce<Promise<{ screen: Screen; check: ScreenCheck }[]>>(async (done, screen) => {
    const found = await done;
    const check = await checkScreen(page, documents, screen);
    return check.matches ? found : [...found, { screen, check }];
  }, Promise.resolve([]));
};

/** Prints each screen of the given pages ("en/commands.md"; all pages when none is given) that differs from chaff. */
const printDiffering = async (names: readonly string[]): Promise<void> => {
  const pages = guidePages().filter((page) => names.length === 0 || names.includes(pageName(page)));
  await pages.reduce<Promise<void>>(async (done, page) => {
    await done;
    (await differingScreens(page)).forEach(({ check }) =>
      console.log(`=== ${pageName(page)}\n--- the page shows\n${check.shown}\n--- chaff prints\n${check.actual}\n`),
    );
  }, Promise.resolve());
};

if (import.meta.main) {
  const [first, ...rest] = process.argv.slice(2);
  if (first === undefined) throw new Error("usage: node scripts/guide-screens.ts <out.json> | --check <lang>/<page>.md ...");
  if (first === "--check") await printDiffering(rest);
  else {
    const fills = await guideScreenFills();
    mkdirSync(dirname(resolve(first)), { recursive: true });
    writeFileSync(resolve(first), `${JSON.stringify(fills, null, 2)}\n`, "utf8");
  }
}
