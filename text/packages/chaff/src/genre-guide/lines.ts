// What a good document of a genre looks like, as lines an AI or a person checks a draft against: genres.yaml's guide:,
// and the replace / add a team writes over it. Pure: the YAML comes in already parsed.

/** The guide's lines by language: { ja: [...], en: [...] }. */
export type GuideLines = Readonly<Record<string, readonly string[]>>;

/** The languages a guide is written in: chaff's. A text written without ja: or en: is given to each. */
export const GUIDE_LANGUAGES: readonly string[] = ["ja", "en"];

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const isLine = (value: unknown): value is string => typeof value === "string" && value.trim() !== "";

/** One line, or a list of them. undefined when anything in it is not a line of text. */
export const linesOf = (value: unknown): string[] | undefined => {
  if (isLine(value)) return [value.trim()];
  if (!Array.isArray(value) || value.length === 0) return undefined;
  const entries: unknown[] = value;
  return entries.every(isLine) ? entries.map((entry) => entry.trim()) : undefined;
};

/**
 * Lines by language as a team writes them: { ja: ..., en: ... }, each one line or a list; or one line or a list alone,
 * which reads the same in every language. undefined when it cannot be read, a language chaff has no guide in included:
 * lines in it would never be shown.
 */
export const guideLinesOf = (value: unknown): GuideLines | undefined => {
  const everywhere = linesOf(value);
  if (everywhere !== undefined) return Object.fromEntries(GUIDE_LANGUAGES.map((language) => [language, everywhere]));
  if (!isRecord(value) || Object.keys(value).length === 0 || Object.keys(value).some((key) => !GUIDE_LANGUAGES.includes(key))) return undefined;
  const read = Object.entries(value).map(([language, lines]) => [language, linesOf(lines)] as const);
  return read.every((entry): entry is readonly [string, string[]] => entry[1] !== undefined) ? Object.fromEntries(read) : undefined;
};

/** A bundled guide: a list of lines in ja and in en. Throws, since the file ships with chaff and a wrong entry is chaff's bug. */
export const bundledGuideOf = (value: unknown, where: string): GuideLines | undefined => {
  if (value === undefined) return undefined;
  const lines = isRecord(value) ? guideLinesOf(value) : undefined;
  if (lines?.["ja"] === undefined || lines["en"] === undefined) throw new Error(`${where}: guide needs a list of lines in ja and in en`);
  return lines;
};
