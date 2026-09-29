/**
 * The language chaff speaks in. Japanese for Japanese, English for everything else: English is the language a
 * reader of any other language is likeliest to read, and every message has an English text.
 */
export type UiLanguage = "ja" | "en";

export const uiLanguageOf = (language: string | undefined): UiLanguage => (language === "ja" ? "ja" : "en");

/** Locale variables in the order POSIX gives them precedence. */
const LOCALE_VARIABLES: readonly string[] = ["LC_ALL", "LC_MESSAGES", "LANG"];

/**
 * The language for output that is not about one document (--help, genres, init, explain, relax, warnings):
 * the language `chaff.yaml` sets, else the terminal's locale, else English. Pure: `env` is passed in.
 */
export const hostLanguage = (configLanguage: string | undefined, env: Readonly<Record<string, string | undefined>>): UiLanguage => {
  if (configLanguage !== undefined) return uiLanguageOf(configLanguage);
  const locale = LOCALE_VARIABLES.map((name) => env[name]).find((value) => value !== undefined && value !== "");
  return locale !== undefined && locale.toLowerCase().startsWith("ja") ? "ja" : "en";
};

/** Several documents end with one closing: in their language when they share one, else the host's. */
export const sharedLanguage = (languages: readonly string[], host: UiLanguage): UiLanguage => {
  const distinct = new Set(languages.map((language) => uiLanguageOf(language)));
  const [only] = [...distinct];
  return distinct.size === 1 && only !== undefined ? only : host;
};

/** Text in both languages. Each module keeps its own, next to where it is used. */
export type Texts<T> = Readonly<Record<UiLanguage, T>>;
