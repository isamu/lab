import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { parse } from "yaml";
import { API_VERSION } from "../api.ts";
import { isInside } from "../custom/module-path.ts";

// A rule pack: a plugin written in YAML alone. Its folder holds a manifest (chaff-plugin.yaml, or a chaff field in
// package.json), rules/*.yaml, lexicons/<language>/<list>.yaml and styles/*.yaml. Read here into the shape a code
// plugin's default export has, so plugin-parse.ts checks a pack exactly as it checks a code plugin. Nothing is run.

export const PACK_MANIFEST = "chaff-plugin.yaml";

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const printed = (value: unknown): string => JSON.stringify(value) ?? typeof value;

const firstLine = (error: unknown): string => (error instanceof Error ? error.message : String(error)).split("\n")[0] ?? "";

/** A YAML file, or why it cannot be read, naming it as the pack's own path (rules/no-tbd.yaml). */
const readYaml = (dir: string, path: string): { readonly value: unknown } | { readonly message: string } => {
  try {
    // A link inside the pack that points out of it would read a file the pack does not hold.
    if (!isInside(realpathSync(dir), realpathSync(join(dir, path)))) return { message: `${path}: it links to a file outside the pack` };
    return { value: parse(readFileSync(join(dir, path), "utf8")) };
  } catch (error) {
    return { message: `${path}: ${firstLine(error)}` };
  }
};

const yamlFilesIn = (dir: string, folder: string): string[] => {
  const full = join(dir, folder);
  if (!existsSync(full) || !statSync(full).isDirectory()) return [];
  return readdirSync(full)
    .filter((file) => file.endsWith(".yaml") || file.endsWith(".yml"))
    .toSorted((left, right) => left.localeCompare(right, "en"))
    .map((file) => `${folder}/${file}`);
};

const foldersIn = (dir: string, folder: string): string[] => {
  const full = join(dir, folder);
  if (!existsSync(full) || !statSync(full).isDirectory()) return [];
  return readdirSync(full)
    .filter((name) => statSync(join(full, name)).isDirectory())
    .toSorted((left, right) => left.localeCompare(right, "en"));
};

const packageJsonOf = (dir: string): Record<string, unknown> | undefined => {
  const read = existsSync(join(dir, "package.json")) ? readYaml(dir, "package.json") : undefined;
  return read !== undefined && "value" in read && isRecord(read.value) ? read.value : undefined;
};

/** The name in the folder's package.json, if it has one. */
export const packageNameOf = (dir: string): string | undefined => {
  const name = packageJsonOf(dir)?.["name"];
  return typeof name === "string" ? name : undefined;
};

/**
 * The manifest of a pack folder: chaff-plugin.yaml, else package.json's chaff field. undefined when the folder is not
 * a pack (a code plugin, loaded by importing it). A manifest that cannot be read is reported, not taken for "not a pack".
 */
export const packManifestOf = (dir: string): { readonly manifest: Record<string, unknown> } | { readonly message: string } | undefined => {
  if (existsSync(join(dir, PACK_MANIFEST))) {
    const read = readYaml(dir, PACK_MANIFEST);
    if ("message" in read) return read;
    // An empty manifest only marks the folder; anything else must be a map.
    if (read.value === null || read.value === undefined) return { manifest: {} };
    return isRecord(read.value) ? { manifest: read.value } : { message: `${PACK_MANIFEST}: write a map (apiVersion: 1), not ${printed(read.value)}` };
  }
  const chaff = packageJsonOf(dir)?.["chaff"];
  if (chaff === undefined) return undefined;
  return isRecord(chaff) ? { manifest: chaff } : { message: `package.json: chaff must be a map ({ "apiVersion": 1 }), not ${printed(chaff)}` };
};

type Read<T> = { readonly value: T } | { readonly message: string };

/** Every file's value in the order of the files, or the first that cannot be read. */
const readAll = (dir: string, paths: readonly string[]): Read<unknown[]> =>
  paths.reduce<Read<unknown[]>>(
    (done, path) => {
      if ("message" in done) return done;
      const read = readYaml(dir, path);
      return "message" in read ? read : { value: [...done.value, read.value] };
    },
    { value: [] },
  );

/** rules/*.yaml: each file holds one rule, or a list of them. */
const rulesOf = (dir: string): Read<unknown[]> => {
  const read = readAll(dir, yamlFilesIn(dir, "rules"));
  return "message" in read ? read : { value: read.value.flatMap((value) => (Array.isArray(value) ? value.map((rule: unknown) => rule) : [value])) };
};

/** lexicons/<language>/<list>.yaml, as a code plugin writes its lexicons: { list: { language: entries } }. */
const lexiconsOf = (dir: string): Read<Record<string, Record<string, unknown>>> =>
  foldersIn(dir, "lexicons").reduce<Read<Record<string, Record<string, unknown>>>>(
    (done, language) => {
      if ("message" in done) return done;
      const paths = yamlFilesIn(dir, `lexicons/${language}`);
      const read = readAll(dir, paths);
      if ("message" in read) return read;
      const merged = paths.reduce<Record<string, Record<string, unknown>>>((acc, path, index) => {
        const list = basename(path).replace(/\.ya?ml$/u, "");
        return { ...acc, [list]: { ...acc[list], [language]: read.value[index] } };
      }, done.value);
      return { value: merged };
    },
    { value: {} },
  );

/** The pack as a plugin's default export: its name and API version from the manifest, its rules, lexicons and styles from its folders. */
export const readPack = (dir: string, manifest: Readonly<Record<string, unknown>>, expectedName: string | undefined): Read<Record<string, unknown>> => {
  const rules = rulesOf(dir);
  if ("message" in rules) return rules;
  const lexicons = lexiconsOf(dir);
  if ("message" in lexicons) return lexicons;
  const styles = readAll(dir, yamlFilesIn(dir, "styles"));
  if ("message" in styles) return styles;
  return {
    value: {
      apiVersion: manifest["apiVersion"] ?? API_VERSION,
      name: manifest["name"] ?? expectedName,
      rules: rules.value,
      lexicons: lexicons.value,
      styles: styles.value,
    },
  };
};
