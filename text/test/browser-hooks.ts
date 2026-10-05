// Runs chaffjs/browser in Node as a bundler would build it for a page: every import (and kuromoji's require) is
// resolved through the "browser" field of the package it is made from, as Vite and other bundlers do. Two things stay
// Node's: the detector registry, which the bundler lists with import.meta.glob at build time, and the paths that registry
// reads from the real file system.
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

type BrowserField = Readonly<Record<string, string>>;

const isBrowserField = (value: unknown): value is BrowserField =>
  typeof value === "object" && value !== null && !Array.isArray(value) && Object.values(value).every((target) => typeof target === "string");

const packages = new Map<string, { readonly dir: string; readonly browser: BrowserField } | undefined>();

const packageOf = (dir: string): { readonly dir: string; readonly browser: BrowserField } | undefined => {
  if (packages.has(dir)) return packages.get(dir);
  const found = ((): { readonly dir: string; readonly browser: BrowserField } | undefined => {
    try {
      const manifest: unknown = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
      const browser = typeof manifest === "object" && manifest !== null && "browser" in manifest ? manifest.browser : undefined;
      return { dir, browser: isBrowserField(browser) ? browser : {} };
    } catch {
      return dirname(dir) === dir ? undefined : packageOf(dirname(dir));
    }
  })();
  packages.set(dir, found);
  return found;
};

/** The bundler's own work, which Node cannot do: the registry stays the one that lists its folder. */
const KEPT_NODE = [`${sep}detectors${sep}index.`, `${sep}detectors${sep}registry-load.`];

const isKept = (path: string): boolean => KEPT_NODE.some((part) => path.includes(part));

const mapped = (pkg: { readonly dir: string; readonly browser: BrowserField }, key: string): string | undefined => {
  const target = pkg.browser[key];
  return target === undefined ? undefined : pathToFileURL(join(pkg.dir, target)).href;
};

const fromBuiltin = (specifier: string, parentPath: string): string | undefined => {
  if (isKept(parentPath)) return undefined;
  const pkg = packageOf(dirname(parentPath));
  return pkg === undefined ? undefined : mapped(pkg, specifier);
};

const fromFile = (url: string): string | undefined => {
  const path = fileURLToPath(url);
  if (isKept(path)) return undefined;
  const pkg = packageOf(dirname(path));
  return pkg === undefined ? undefined : mapped(pkg, `./${relative(pkg.dir, path).split(sep).join("/")}`);
};

/** Every module put in another's place so far, as a path from the text folder with / between names. */
const swapped = new Set<string>();

const TEXT_DIR = join(import.meta.dirname, "..");

const remember = (url: string): string => {
  swapped.add(relative(TEXT_DIR, fileURLToPath(url)).split(sep).join("/"));
  return url;
};

export const swappedModules = (): readonly string[] => [...swapped].toSorted((left, right) => left.localeCompare(right, "en"));

export const registerBrowserHooks = (): void => {
  registerHooks({
    resolve: (specifier, context, nextResolve) => {
      const parentPath = context.parentURL?.startsWith("file:") ? fileURLToPath(context.parentURL) : undefined;
      const builtin = specifier.startsWith("node:") && parentPath !== undefined ? fromBuiltin(specifier, parentPath) : undefined;
      if (builtin !== undefined) return { url: remember(builtin), shortCircuit: true };
      const resolved = nextResolve(specifier, context);
      const browser = resolved.url.startsWith("file:") ? fromFile(resolved.url) : undefined;
      return browser === undefined ? resolved : { url: remember(browser), shortCircuit: true };
    },
  });
};
