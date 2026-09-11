import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { isRecord } from "./package-json.ts";

/**
 * Locates an executable scoria depends on, from scoria's own install.
 *
 * The target repository's node_modules is not on the path and must not be — scoria brings its own
 * ruleset (spec §3.2.1), so it has to bring the tool that enforces it. Resolving through
 * `createRequire` finds it wherever npx unpacked scoria.
 */

const require_ = createRequire(import.meta.url);

/**
 * The same lookup, but from the target repository rather than scoria's own install.
 *
 * Type checking is the one place scoria must use the project's tool (spec §12.1): a type check is
 * only meaningful against that project's tsconfig and its installed type definitions.
 */
export const resolveBinFrom = (root: string, packageName: string, binName: string): string | undefined => {
  const fromTarget = createRequire(join(root, "package.json"));
  try {
    const entry = fromTarget.resolve(packageName);
    const manifest = climbToManifest(entry, packageName);
    if (manifest === undefined) return undefined;
    const parsed: unknown = JSON.parse(readFileSync(manifest, "utf8"));
    const relative = binField(parsed, binName);
    return relative === undefined ? undefined : join(dirname(manifest), relative);
  } catch {
    return undefined;
  }
};

const binField = (pkg: unknown, name: string): string | undefined => {
  if (!isRecord(pkg)) return undefined;
  const bin = pkg["bin"];
  if (typeof bin === "string") return bin;
  if (!isRecord(bin)) return undefined;
  const entry = bin[name];
  return typeof entry === "string" ? entry : undefined;
};

/**
 * A package that declares `exports` blocks a deep import of its own package.json, so resolving the
 * manifest directly fails for exactly the modern packages worth depending on. Fall back to
 * resolving the entry point and walking up to the directory that owns it.
 */
const manifestOf = (packageName: string): string | undefined => {
  try {
    return require_.resolve(`${packageName}/package.json`);
  } catch {
    return climbToManifest(require_.resolve(packageName), packageName);
  }
};

const climbToManifest = (entry: string, packageName: string): string | undefined => {
  const segments = packageName.split("/");
  const owner = segments.at(-1) ?? packageName;
  // Walk up from the resolved entry; the first directory named after the package owns the manifest.
  let directory = dirname(entry);
  while (directory !== dirname(directory)) {
    if (basename(directory) === owner) return join(directory, "package.json");
    directory = dirname(directory);
  }
  return undefined;
};

export const resolveBin = (packageName: string, binName: string): string | undefined => {
  try {
    const manifest = manifestOf(packageName);
    if (manifest === undefined) return undefined;
    const parsed: unknown = JSON.parse(readFileSync(manifest, "utf8"));
    const relative = binField(parsed, binName);
    return relative === undefined ? undefined : join(dirname(manifest), relative);
  } catch {
    return undefined;
  }
};
