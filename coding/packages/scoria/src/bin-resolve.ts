import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { isRecord } from "./package-json.ts";

/**
 * Locates an executable, either from scoria's own install or from the target repository's.
 *
 * scoria brings its own ruleset (spec §3.2.1), so it brings the tools that enforce it and resolves
 * them from its own install. `tsc` is the exception: a type check is only meaningful against the
 * project's own tsconfig and installed types, so that one is resolved from the target.
 */

type Resolver = (specifier: string) => string;

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
const climbToManifest = (entry: string, packageName: string): string | undefined => {
  const owner = packageName.split("/").at(-1) ?? packageName;
  // Walk up from the resolved entry; the first directory named after the package owns the manifest.
  let directory = dirname(entry);
  while (directory !== dirname(directory)) {
    if (basename(directory) === owner) return join(directory, "package.json");
    directory = dirname(directory);
  }
  return undefined;
};

const manifestOf = (resolve: Resolver, packageName: string): string | undefined => {
  try {
    return resolve(`${packageName}/package.json`);
  } catch {
    return climbToManifest(resolve(packageName), packageName);
  }
};

const binPath = (resolve: Resolver, packageName: string, binName: string): string | undefined => {
  try {
    const manifest = manifestOf(resolve, packageName);
    if (manifest === undefined) return undefined;
    const parsed: unknown = JSON.parse(readFileSync(manifest, "utf8"));
    const relative = binField(parsed, binName);
    return relative === undefined ? undefined : join(dirname(manifest), relative);
  } catch {
    return undefined;
  }
};

const fromHere = createRequire(import.meta.url);

/** A tool scoria ships, resolved from wherever npx unpacked scoria. */
export const resolveBin = (packageName: string, binName: string): string | undefined =>
  binPath((specifier) => fromHere.resolve(specifier), packageName, binName);

/** A tool belonging to the repository being measured. */
export const resolveBinFrom = (root: string, packageName: string, binName: string): string | undefined => {
  const fromTarget = createRequire(join(root, "package.json"));
  return binPath((specifier) => fromTarget.resolve(specifier), packageName, binName);
};
