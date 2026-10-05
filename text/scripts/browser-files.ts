// The files chaff and its language packages read as they run (rules, genres, profiles, styles, lexicons), as JSON for
// chaffjs/browser, and kuromoji's dictionary beside them. A page serves the folder and fetches only what a check needs.
//   node scripts/browser-files.ts <out dir>
// writes <out dir>/files/<package name>.json (path in the package → text) and <out dir>/kuromoji/ (the *.dat.gz files).
import { copyFileSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { PackageFiles } from "../packages/chaff/src/browser-files.ts";

const TEXT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");

/** What each package reads from its own folder, as package-files.ts in each package reads it. */
export const BROWSER_PACKAGES: readonly { readonly name: string; readonly dir: string; readonly entries: readonly string[] }[] = [
  {
    name: "chaffjs",
    dir: "packages/chaff",
    entries: ["genres.yaml", "reference-headings.yaml", "structure-baseline.yaml", "rules", "profiles", "styles"],
  },
  { name: "@chaffjs/lang-ja", dir: "packages/lang-ja", entries: ["lexicons"] },
  { name: "@chaffjs/lang-en", dir: "packages/lang-en", entries: ["lexicons"] },
];

/** A folder's files in the order the file system lists them, as the package's own readdir sees them. */
const filesIn = (packageDir: string, entry: string): string[] =>
  readdirSync(join(packageDir, entry))
    .filter((name) => statSync(join(packageDir, entry, name)).isFile())
    .map((name) => `${entry}/${name}`);

export const packageFilesOf = (packageDir: string, entries: readonly string[]): PackageFiles =>
  Object.fromEntries(
    entries
      .flatMap((entry) => (statSync(join(packageDir, entry)).isDirectory() ? filesIn(packageDir, entry) : [entry]))
      .map((path) => [path, readFileSync(join(packageDir, path), "utf8")]),
  );

/** Every package's files, by package name, read from this checkout. */
export const browserFiles = (): Readonly<Record<string, PackageFiles>> =>
  Object.fromEntries(BROWSER_PACKAGES.map((entry) => [entry.name, packageFilesOf(join(TEXT_DIR, entry.dir), entry.entries)]));

/** The folder of kuromoji's dictionary, found as lang-ja finds it. */
export const kuromojiDictionaryDir = (): string =>
  join(dirname(createRequire(join(TEXT_DIR, "packages/lang-ja/package.json")).resolve("@sglkc/kuromoji/package.json")), "dict");

const write = (outDir: string): void => {
  Object.entries(browserFiles()).forEach(([name, files]) => {
    const path = join(outDir, "files", `${name}.json`);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(files));
  });
  const dictionary = join(outDir, "kuromoji");
  mkdirSync(dictionary, { recursive: true });
  readdirSync(kuromojiDictionaryDir()).forEach((name) => copyFileSync(join(kuromojiDictionaryDir(), name), join(dictionary, name)));
};

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  const outDir = process.argv[2];
  if (outDir === undefined) {
    console.error("usage: node scripts/browser-files.ts <out dir>");
    process.exitCode = 2;
  } else {
    write(outDir);
  }
}
