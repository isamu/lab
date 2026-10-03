import { existsSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { CONFIG_FILE, type Config } from "../config/load.ts";
import { modulePathOf } from "../custom/module-path.ts";
import { loadGenres } from "../genre-load.ts";
import { importDefault } from "./import-default.ts";
import { staysInside } from "./real-path.ts";
import { isPluginPath, pluginNameOfPackage } from "./plugin-name.ts";
import { parsePlugin, type ParsedPlugin, type PluginOrigin, type PluginProblem } from "./plugin-parse.ts";
import { PACK_MANIFEST, packManifestOf, packageNameOf, readPack } from "./pack-read.ts";

// The plugins chaff.yaml lists under plugins:, found and loaded. A package is found from the folder chaff.yaml is in,
// as Node finds it (node_modules); a path is the project's own plugin and, like a module rule, may not leave that
// folder unless written as an absolute path. What cannot be found or read stops the run.

export type LoadedPlugins = { readonly plugins: readonly ParsedPlugin[]; readonly problems: readonly PluginProblem[] };

/** pack: the folder of a rule pack (YAML only), which is read rather than imported. */
type Located = { readonly origin: PluginOrigin; readonly pack?: string } | { readonly problem: PluginProblem };

const problemOf = (kind: Exclude<PluginProblem["kind"], "rule">, plugin: string, detail = ""): { problem: PluginProblem } => ({
  problem: { kind, plugin, detail },
});

/** The file Node would load for specifier from the folder chaff.yaml is in, or undefined when there is none. */
const resolveFrom = (baseDir: string, specifier: string): string | undefined => {
  try {
    return createRequire(join(baseDir, CONFIG_FILE)).resolve(specifier);
  } catch {
    return undefined;
  }
};

const isFolder = (path: string): boolean => existsSync(path) && statSync(path).isDirectory();

/** A folder that is a rule pack: it has a manifest. A folder that is a code plugin is imported as Node imports it. */
const isPack = (dir: string): boolean => packManifestOf(dir) !== undefined;

/** The folder Node would find package name in from the folder chaff.yaml is in, whatever the package exports. */
const packageFolder = (baseDir: string, name: string): string | undefined =>
  (createRequire(join(baseDir, CONFIG_FILE)).resolve.paths(name) ?? [])
    .map((nodeModules) => join(nodeModules, name))
    .find((dir) => existsSync(join(dir, "package.json")));

const packAt = (written: string, dir: string, expectedName: string | undefined): Located => ({
  origin: { written, file: join(dir, PACK_MANIFEST), expectedName },
  pack: dir,
});

/** A pack of the project's own takes its name from its package.json (chaff-plugin-foo is foo) when its manifest does not give one. */
const localPackName = (dir: string): string | undefined => {
  const name = packageNameOf(dir);
  return name === undefined ? undefined : pluginNameOfPackage(name);
};

/** A plugin of the project's own, by its path: a pack folder, or a file (or folder) Node imports. Neither may leave the project. */
const locatePath = (written: string, baseDir: string): Located => {
  const path = modulePathOf(written, baseDir);
  if ("refusal" in path) return problemOf("outside", written);
  if (isFolder(path.file) && isPack(path.file))
    return staysInside(written, path.file, baseDir) ? packAt(written, path.file, localPackName(path.file)) : problemOf("outside", written);
  const file = resolveFrom(baseDir, path.file);
  if (file === undefined) return problemOf("not-found", written);
  return staysInside(written, file, baseDir) ? { origin: { written, file, expectedName: undefined } } : problemOf("outside", written);
};

const locate = (written: string, baseDir: string): Located => {
  if (isPluginPath(written)) return locatePath(written, baseDir);
  const expectedName = pluginNameOfPackage(written);
  if (expectedName === undefined) return problemOf("bad-specifier", written);
  const folder = packageFolder(baseDir, written);
  if (folder !== undefined && isPack(folder)) return packAt(written, folder, expectedName);
  const file = resolveFrom(baseDir, written);
  return file === undefined ? problemOf("not-found", written) : { origin: { written, file, expectedName } };
};

/** A rule pack read into what a code plugin's default export would be. Nothing in it runs. */
const readPackAt = (dir: string, expectedName: string | undefined): { readonly exported: unknown } | { readonly message: string } => {
  const manifest = packManifestOf(dir);
  if (manifest !== undefined && "message" in manifest) return manifest;
  const read = readPack(dir, manifest?.manifest ?? {}, expectedName);
  return "message" in read ? read : { exported: read.value };
};

const loadPlugin = async (written: string, baseDir: string, useFor: readonly string[]): Promise<LoadedPlugins> => {
  const located = locate(written, baseDir);
  if ("problem" in located) return { plugins: [], problems: [located.problem] };
  const imported = located.pack === undefined ? await importDefault(located.origin.file) : readPackAt(located.pack, located.origin.expectedName);
  if ("message" in imported) return { plugins: [], problems: [problemOf("import-failed", written, imported.message).problem] };
  const read = parsePlugin(imported.exported, located.origin, useFor);
  return { plugins: read.plugin === undefined ? [] : [read.plugin], problems: read.problems };
};

/** A second plugin with a name already taken is refused: its rules' ids would be the first one's. */
const withoutDuplicates = (loaded: readonly { written: string; result: LoadedPlugins }[]): LoadedPlugins =>
  loaded.reduce<{ plugins: ParsedPlugin[]; problems: PluginProblem[] }>(
    (acc, { written, result }) => {
      const taken = result.plugins.filter((plugin) => acc.plugins.some((seen) => seen.name === plugin.name));
      return {
        plugins: [...acc.plugins, ...result.plugins.filter((plugin) => !taken.includes(plugin))],
        problems: [...acc.problems, ...result.problems, ...taken.map((plugin) => problemOf("duplicate-name", written, plugin.name).problem)],
      };
    },
    { plugins: [], problems: [] },
  );

const isStringList = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === "string" && entry.trim() !== "");

/** Every plugin chaff.yaml lists, loaded one by one in the order written. */
export const loadPlugins = async (config: Pick<Config, "plugins" | "baseDir">): Promise<LoadedPlugins> => {
  const written: unknown = config.plugins;
  if (written === undefined || written === null) return { plugins: [], problems: [] };
  if (!isStringList(written)) return { plugins: [], problems: [problemOf("not-a-list", "plugins", JSON.stringify(written) ?? "").problem] };
  const useFor = loadGenres().groups.map((group) => group.id);
  const loaded = await written.reduce<Promise<{ written: string; result: LoadedPlugins }[]>>(
    async (done, entry) => [...(await done), { written: entry.trim(), result: await loadPlugin(entry.trim(), config.baseDir, useFor) }],
    Promise.resolve([]),
  );
  return withoutDuplicates(loaded);
};
