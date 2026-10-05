// The files chaff and its language packages ship (rules, genres, lexicons), held in memory for a build without a file
// system. Every package reads its own through `packageFiles`, with the same paths the file system would give: one store,
// imported by name (chaffjs/browser-files) so the browser entry and each package's reads meet in the same module.

/** One package's files: path in the package (rules/max-sentence-length.yaml) → text. */
export type PackageFiles = Readonly<Record<string, string>>;

/** Where the files come from, and where kuromoji's dictionary is served (a URL ending in /). */
export type BrowserSetup = {
  readonly files: (packageName: string) => Promise<PackageFiles>;
  readonly kuromojiDictionaryUrl: string;
};

type Store = { setup: BrowserSetup | undefined; readonly installed: Map<string, PackageFiles> };

const store: Store = { setup: undefined, installed: new Map() };

/** Each dictionary file is fetched at new URL(file name, kuromojiDictionaryUrl), so that URL must be absolute and end in /. */
export const setupBrowserFiles = (setup: BrowserSetup): void => {
  if (!URL.canParse(setup.kuromojiDictionaryUrl) || !setup.kuromojiDictionaryUrl.endsWith("/"))
    throw new Error(`chaff: kuromojiDictionaryUrl must be an absolute URL ending in /: ${setup.kuromojiDictionaryUrl}`);
  store.setup = setup;
};

const setupOf = (): BrowserSetup => {
  if (store.setup === undefined) throw new Error("chaff: call setupBrowser() before check()");
  return store.setup;
};

/** Asks for a package's files the first time they are needed, and keeps them. */
export const ensurePackageFiles = async (packageName: string): Promise<void> => {
  if (store.installed.has(packageName)) return;
  const files = await setupOf().files(packageName);
  store.installed.set(packageName, files);
};

export const kuromojiDictionaryUrl = (): string => setupOf().kuromojiDictionaryUrl;

/** A package's files as a read-only file system rooted at /<package name>. */
export type PackageFileReader = {
  readonly root: string;
  readonly readText: (path: string) => string;
  readonly readDir: (path: string) => string[];
  readonly exists: (path: string) => boolean;
};

const filesOf = (packageName: string): PackageFiles => {
  const files = store.installed.get(packageName);
  if (files === undefined) throw new Error(`chaff: the files of ${packageName} are not loaded`);
  return files;
};

const inPackage = (root: string, path: string): string | undefined => (path.startsWith(`${root}/`) ? path.slice(root.length + 1) : undefined);

const childrenOf = (files: PackageFiles, dir: string): string[] =>
  Object.keys(files).flatMap((key) => {
    if (!key.startsWith(`${dir}/`)) return [];
    const name = key.slice(dir.length + 1);
    return name.includes("/") ? [] : [name];
  });

const noSuchFile = (path: string): Error => Object.assign(new Error(`ENOENT: no such file or directory, '${path}'`), { code: "ENOENT" });

export const packageFiles = (packageName: string): PackageFileReader => {
  const root = `/${packageName}`;
  return {
    root,
    readText: (path) => {
      const key = inPackage(root, path);
      const text = key === undefined ? undefined : filesOf(packageName)[key];
      if (text === undefined) throw noSuchFile(path);
      return text;
    },
    readDir: (path) => {
      const key = inPackage(root, path);
      const names = key === undefined ? [] : childrenOf(filesOf(packageName), key);
      if (names.length === 0) throw noSuchFile(path);
      return names;
    },
    exists: (path) => {
      const key = inPackage(root, path);
      if (key === undefined) return false;
      const files = filesOf(packageName);
      return Object.hasOwn(files, key) || childrenOf(files, key).length > 0;
    },
  };
};
