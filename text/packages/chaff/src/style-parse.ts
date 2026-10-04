import { isLevel } from "./levels.ts";
import type { Level, Localized } from "./plugin.ts";
import { guideLayerOf, type GuideLayer } from "./genre-guide/layer.ts";
import { guideProblemText } from "./genre-guide/problem-text.ts";
import { knownGenres } from "./known-genres.ts";

// A house style (styles/*.yaml): a well-known guideline a team picks with style: in chaff.yaml. It sets rule levels and
// options, and says where they come from. Pure: the YAML comes in already parsed.

export type StyleSource = { readonly title: Localized; readonly url: string };

/** { rule id: { language: limit } }. A guideline gives a number for one language (60 characters for Japanese) and none for another. */
export type StyleLimits = Readonly<Record<string, Readonly<Record<string, number>>>>;

export type StyleDefinition = {
  readonly id: string;
  readonly name: Localized;
  /** What the style decides, in one or two plain sentences. */
  readonly summary: Localized;
  /** The guideline the style follows, so a reader can check it. */
  readonly source: StyleSource;
  readonly rules: Readonly<Record<string, Level>>;
  /** { rule id: { option: value } }, checked against the rules' declared options by the tests. */
  readonly options: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  /** The numbers the guideline sets, by language. The rule needs a level under rules too, or the limit decides nothing. */
  readonly limits: StyleLimits;
  /** Its changes to the genre guides (genre-guide/layer.ts), between a rule pack's and chaff.yaml's. */
  readonly guide?: GuideLayer | undefined;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const isLocalized = (value: unknown): value is Localized =>
  isRecord(value) && typeof value["ja"] === "string" && typeof value["en"] === "string" && value["ja"] !== "" && value["en"] !== "";

const localizedOf = (value: unknown, field: string, where: string): Localized => {
  if (!isLocalized(value)) throw new Error(`${where}: ${field} needs a ja and an en text`);
  return value;
};

const sourceOf = (value: unknown, where: string): StyleSource => {
  if (!isRecord(value)) throw new Error(`${where}: source needs a title and a url`);
  const url = value["url"];
  if (typeof url !== "string" || !url.startsWith("https://")) throw new Error(`${where}: source.url must be an https:// address`);
  return { title: localizedOf(value["title"], "source.title", where), url };
};

const levelsOf = (value: unknown, where: string): Record<string, Level> => {
  if (value === undefined) return {};
  if (!isRecord(value)) throw new Error(`${where}: rules must be a map of rule ids to levels`);
  return Object.fromEntries(
    Object.entries(value).map(([id, level]) => {
      if (!isLevel(level)) throw new Error(`${where}: ${id} has the level ${String(level)}; use strict, normal, relaxed or off`);
      return [id, level];
    }),
  );
};

const optionsOf = (value: unknown, where: string): Record<string, Readonly<Record<string, unknown>>> => {
  if (value === undefined) return {};
  if (!isRecord(value)) throw new Error(`${where}: options must be a map of rule ids`);
  return Object.fromEntries(
    Object.entries(value).map(([id, options]) => {
      if (!isRecord(options)) throw new Error(`${where}: options.${id} must be a map of option names to values`);
      return [id, options];
    }),
  );
};

const isLimit = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value > 0;

const languageLimitsOf = (id: string, value: unknown, where: string): Record<string, number> => {
  if (!isRecord(value) || Object.keys(value).length === 0) throw new Error(`${where}: limits.${id} must be a map of languages to numbers`);
  return Object.fromEntries(
    Object.entries(value).map(([language, limit]) => {
      if (!isLimit(limit)) throw new Error(`${where}: limits.${id}.${language} must be a number above 0`);
      return [language, limit];
    }),
  );
};

const limitsOf = (value: unknown, rules: Readonly<Record<string, Level>>, where: string): Record<string, Record<string, number>> => {
  if (value === undefined) return {};
  if (!isRecord(value)) throw new Error(`${where}: limits must be a map of rule ids`);
  return Object.fromEntries(
    Object.entries(value).map(([id, byLanguage]) => {
      if (rules[id] === undefined || rules[id] === "off") throw new Error(`${where}: limits.${id} needs ${id} under rules at a level that runs`);
      return [id, languageLimitsOf(id, byLanguage, where)];
    }),
  );
};

/** The style's guide: as a layer named after the style. undefined when it writes none. */
const guideOf = (value: unknown, id: string, where: string): GuideLayer | undefined => {
  if (value === undefined) return undefined;
  const read = guideLayerOf(value, `style: ${id}`, knownGenres());
  const [problem] = read.problems;
  if (problem !== undefined) throw new Error(`${where}: ${guideProblemText(problem, "en")}`);
  return read.layer;
};

/** One style file. Throws on anything it cannot read: the file ships with chaff, so a wrong entry is chaff's bug. */
export const parseStyle = (raw: unknown, file: string): StyleDefinition => {
  const id = isRecord(raw) ? raw["id"] : undefined;
  if (isRecord(raw) && (typeof id !== "string" || `${id}.yaml` !== file)) throw new Error(`${file}: id must be the file's name without .yaml`);
  return styleOf(raw, file);
};

/** One style, wherever it was written (where names it in what is thrown). Throws on anything it cannot read. */
export const styleOf = (raw: unknown, where: string): StyleDefinition => {
  if (!isRecord(raw)) throw new Error(`${where}: a style must be a map`);
  const id = raw["id"];
  if (typeof id !== "string" || id === "") throw new Error(`${where}: a style needs an id`);
  const rules = levelsOf(raw["rules"], where);
  const options = optionsOf(raw["options"], where);
  const guide = guideOf(raw["guide"], id, where);
  if (Object.keys(rules).length === 0 && Object.keys(options).length === 0 && guide === undefined) {
    throw new Error(`${where}: a style must set rules, options or guide`);
  }
  return {
    id,
    name: localizedOf(raw["name"], "name", where),
    summary: localizedOf(raw["summary"], "summary", where),
    source: sourceOf(raw["source"], where),
    rules,
    options,
    limits: limitsOf(raw["limits"], rules, where),
    ...(guide === undefined ? {} : { guide }),
  };
};
