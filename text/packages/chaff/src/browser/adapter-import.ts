import { ensurePackageFiles } from "chaffjs/browser-files";

// adapter-import.ts in a bundle: a bundler cannot follow an import by a name known only at run time, so the bundled
// languages are named here, each loaded only when a document in it is checked, after its files.

const ADAPTERS: Readonly<Record<string, () => Promise<unknown>>> = {
  "@chaffjs/lang-ja": () => import("@chaffjs/lang-ja"),
  "@chaffjs/lang-en": () => import("@chaffjs/lang-en"),
};

/** The error Node gives for a package that is not installed, which adapter-load.ts reads as "not installed". */
const notInstalled = (specifier: string): Error => Object.assign(new Error(`Cannot find package '${specifier}'`), { code: "ERR_MODULE_NOT_FOUND" });

export const importPackage = async (specifier: string): Promise<unknown> => {
  const load = Object.hasOwn(ADAPTERS, specifier) ? ADAPTERS[specifier] : undefined;
  if (load === undefined) throw notInstalled(specifier);
  await ensurePackageFiles(specifier);
  return load();
};
