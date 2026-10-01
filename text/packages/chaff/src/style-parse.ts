import { isLevel } from "./levels.ts";
import type { Level, Localized } from "./plugin.ts";

// A house style (styles/*.yaml): a well-known guideline a team picks with style: in chaff.yaml. It sets rule levels and
// options, and says where they come from. Pure: the YAML comes in already parsed.

export type StyleSource = { readonly title: Localized; readonly url: string };

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

/** One style file. Throws on anything it cannot read: the file ships with chaff, so a wrong entry is chaff's bug. */
export const parseStyle = (raw: unknown, file: string): StyleDefinition => {
  if (!isRecord(raw)) throw new Error(`${file}: a style must be a map`);
  const id = raw["id"];
  if (typeof id !== "string" || `${id}.yaml` !== file) throw new Error(`${file}: id must be the file's name without .yaml`);
  const where = `${file}`;
  const rules = levelsOf(raw["rules"], where);
  const options = optionsOf(raw["options"], where);
  if (Object.keys(rules).length === 0 && Object.keys(options).length === 0) throw new Error(`${where}: a style must set rules or options`);
  return {
    id,
    name: localizedOf(raw["name"], "name", where),
    summary: localizedOf(raw["summary"], "summary", where),
    source: sourceOf(raw["source"], where),
    rules,
    options,
  };
};
