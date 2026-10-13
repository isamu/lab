// The runs the home page shows. Each runs chaff's command line in site/src/home/<lang>/<example>/ when the site is built
// (scripts/home-screens.ts, from yarn examples), so the page shows what chaff prints now, never a screen typed by hand.

export const HOME_EXAMPLES = ["contract", "draft", "rewrite", "team"] as const;
export type HomeExample = (typeof HOME_EXAMPLES)[number];
type HomeLang = "ja" | "en";

/** The arguments each example runs with; the last one is the document the page shows. */
export const HOME_ARGS: Readonly<Record<HomeLang, Readonly<Record<HomeExample, readonly string[]>>>> = {
  en: {
    contract: ["--compact", "--genre", "legal/contract", "contract.md"],
    draft: ["--compact", "draft.md"],
    rewrite: ["--compact", "rewrite.md"],
    team: ["--compact", "proposal.md"],
  },
  ja: {
    contract: ["--compact", "--genre", "legal/contract", "契約書.md"],
    draft: ["--compact", "下書き.md"],
    rewrite: ["--compact", "書き直し.md"],
    team: ["--compact", "提案書.md"],
  },
};

/** One example as built: the command as a reader types it, the example's files by name, and what chaff printed. */
export type HomeScreen = { readonly command: string; readonly files: Readonly<Record<string, string>>; readonly output: string };
export type HomeScreens = Readonly<Record<HomeLang, Readonly<Record<HomeExample, HomeScreen>>>>;

/** The command line a reader types for an example. */
export const homeCommand = (args: readonly string[]): string => ["npx chaffjs", ...args].join(" ");

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const isHomeScreen = (value: unknown): value is HomeScreen =>
  isObject(value) &&
  typeof value["command"] === "string" &&
  typeof value["output"] === "string" &&
  isObject(value["files"]) &&
  Object.values(value["files"]).every((text) => typeof text === "string");

const isLangScreens = (value: unknown): boolean => isObject(value) && HOME_EXAMPLES.every((example) => isHomeScreen(value[example]));

/** Whether a parsed file is what scripts/home-screens.ts writes: every example in both languages. */
export const isHomeScreens = (value: unknown): value is HomeScreens =>
  isObject(value) && isLangScreens(value["en"]) && isLangScreens(value["ja"]);
