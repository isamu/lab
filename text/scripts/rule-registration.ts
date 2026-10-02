/** One detector as the hand-written DETECTORS map registered it: the key, the imported name, and the module it came from. */
export type Registration = { readonly howToFind: string; readonly name: string; readonly module: string };

const IMPORT = /import \{([^}]*)\} from "\.\/([^"]+)"/g;
const KEY = /^[a-z0-9-]+$/;
const NAME = /^[A-Za-z_$][\w$]*$/;

/** `"key": name,` or `key: name,` as [key, name]; anything else (a comment, a blank line) as nothing. */
const entryOf = (line: string): [string, string] | undefined => {
  const [rawKey = "", rawName = "", ...rest] = line.trim().replace(/,$/, "").split(":");
  const key = rawKey.trim().replace(/^"(.*)"$/, "$1");
  const name = rawName.trim();
  return rest.length === 0 && KEY.test(key) && NAME.test(name) ? [key, name] : undefined;
};

/** The module each name in `import { a, b } from "./x.ts"` comes from, by name. */
const importedModules = (source: string): ReadonlyMap<string, string> =>
  new Map(
    [...source.matchAll(IMPORT)].flatMap(([, names = "", module = ""]) =>
      names
        .split(",")
        .map((name) => name.trim())
        .filter((name) => name.length > 0 && !name.startsWith("type "))
        .map((name) => [name, module] as const),
    ),
  );

/** The lines between `DETECTORS ... = {` and the `};` that closes it. */
const mapLines = (source: string): string[] => {
  const lines = source.split("\n");
  const start = lines.findIndex((line) => /\bDETECTORS\b.*=\s*\{\s*$/.test(line));
  if (start === -1) return [];
  const body = lines.slice(start + 1);
  const end = body.findIndex((line) => /^\s*\};?\s*$/.test(line));
  return end === -1 ? body : body.slice(0, end);
};

/** Every entry of a detectors/index.ts written as one hand-maintained map. Throws when an entry's name was never imported. */
export const registrationsIn = (source: string): Registration[] => {
  const modules = importedModules(source);
  return mapLines(source).flatMap((line) => {
    const [howToFind, name] = entryOf(line) ?? [];
    if (howToFind === undefined || name === undefined) return [];
    const module = modules.get(name);
    if (module === undefined) throw new Error(`migrate: ${name} (for "${howToFind}") is not imported from a module in detectors/`);
    return [{ howToFind, name, module }];
  });
};

/** The file packages/chaff/src/detectors/registry/<howToFind>.ts that registers the detector. */
export const registryFileText = ({ name, module }: Registration): string =>
  [`import type { Detector } from "../../plugin.ts";`, `import { ${name} } from "../${module}";`, "", `export const detector: Detector = ${name};`, ""].join(
    "\n",
  );
