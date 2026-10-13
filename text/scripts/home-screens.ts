// Runs chaff's command line on the home page's examples (site/src/home/<lang>/<example>/) and writes, for each, the
// command, the example's files and what chaff printed, for the home page to show.
//   node scripts/home-screens.ts <out.json>
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { HOME_ARGS, homeCommand, type HomeExample, type HomeScreen } from "../site/src/lib/homeExamples.ts";
import { runCli } from "../test/cli-run.ts";

const HOME = join(import.meta.dirname, "..", "site", "src", "home");
const LOCALES = { ja: "ja_JP.UTF-8", en: "en_US.UTF-8" } as const;
type Language = keyof typeof LOCALES;

const filesOf = (dir: string): Record<string, string> => Object.fromEntries(readdirSync(dir).map((name) => [name, readFileSync(join(dir, name), "utf8")]));

const LEADING_BLANK_LINES = /^\n+/u;

const screenOf = async (language: Language, example: HomeExample): Promise<HomeScreen> => {
  const args = HOME_ARGS[language][example];
  const files = filesOf(join(HOME, language, example));
  const document = args.at(-1) ?? "";
  if (files[document] === undefined) throw new Error(`home-screens: ${language}/${example} has no ${document}`);
  const run = await runCli(files, args, LOCALES[language]);
  rmSync(run.dir, { recursive: true, force: true });
  return { command: homeCommand(args), files, output: run.both.replace(LEADING_BLANK_LINES, "").trimEnd() };
};

// One at a time, in order: the command line runs in the example's folder, and the working directory is the process's.
const screensOf = async (language: Language): Promise<Record<HomeExample, HomeScreen>> => ({
  contract: await screenOf(language, "contract"),
  draft: await screenOf(language, "draft"),
  rewrite: await screenOf(language, "rewrite"),
  team: await screenOf(language, "team"),
});

const out = process.argv[2];
if (out === undefined) throw new Error("usage: node scripts/home-screens.ts <out.json>");
const target = resolve(out);
const screens = { en: await screensOf("en"), ja: await screensOf("ja") };
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, `${JSON.stringify(screens, null, 2)}\n`);
