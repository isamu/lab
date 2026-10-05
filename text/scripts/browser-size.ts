// What the playground page makes a browser download, measured on the built site: the scripts the page loads at once,
// the scripts it loads at the first check (chaff, then each language), chaff's files and kuromoji's dictionary.
// Bytes as stored and gzipped (what a server that compresses sends).
//   node scripts/browser-size.ts site/dist        (after the site's build)
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

type Size = { readonly raw: number; readonly gzip: number };

const sizeOf = (path: string): Size => {
  const bytes = readFileSync(path);
  return { raw: bytes.length, gzip: gzipSync(bytes).length };
};

const sum = (sizes: readonly Size[]): Size => sizes.reduce((acc, size) => ({ raw: acc.raw + size.raw, gzip: acc.gzip + size.gzip }), { raw: 0, gzip: 0 });

const STATIC_IMPORT = /(?:from|import)\s*"\.\/([^"]+\.js)"/gu;
const DYNAMIC_IMPORT = /import\(\s*["`]\.\/([^"`]+\.js)["`]\s*\)/gu;

const importsOf = (assets: string, chunk: string, pattern: RegExp): string[] =>
  [...readFileSync(join(assets, chunk), "utf8").matchAll(pattern)].map((match) => match[1] ?? "");

/** A chunk and every chunk it imports statically: what loading it downloads. */
const closureOf = (assets: string, entries: readonly string[]): Set<string> => {
  const seen = new Set<string>();
  const visit = (chunk: string): void => {
    if (seen.has(chunk)) return;
    seen.add(chunk);
    importsOf(assets, chunk, STATIC_IMPORT).forEach(visit);
  };
  entries.forEach(visit);
  return seen;
};

const filesUnder = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => (statSync(join(dir, name)).isDirectory() ? filesUnder(join(dir, name)) : [join(dir, name)]));

const line = (label: string, size: Size): string => `${label.padEnd(56)} ${String(size.raw).padStart(10)} ${String(size.gzip).padStart(10)}`;

/** A chunk loaded later by import(), and what is already loaded when it is: the page's scripts and what imported it. */
type Later = { readonly chunk: string; readonly loaded: ReadonlySet<string> };

/** The chunks loaded later, from the page's scripts or from one another: chaff at the first check, then a language. */
const laterChunks = (assets: string, atOnce: ReadonlySet<string>): Later[] => {
  const found: Later[] = [];
  const visit = (chunk: string, loaded: ReadonlySet<string>): void =>
    importsOf(assets, chunk, DYNAMIC_IMPORT)
      .filter((next) => !loaded.has(next) && !found.some((entry) => entry.chunk === next))
      .forEach((next) => {
        found.push({ chunk: next, loaded });
        visit(next, new Set([...loaded, ...closureOf(assets, [next])]));
      });
  atOnce.forEach((chunk) => visit(chunk, atOnce));
  return found;
};

/** Which language a chunk is the analyser of, by the library it bundles. */
const languageOf = (code: string): string => {
  if (code.includes("kuromoji")) return " (Japanese)";
  return code.includes("wink") ? " (English)" : "";
};

const report = (dist: string): string[] => {
  const assets = join(dist, "_astro");
  const page = readFileSync(join(dist, "en", "playground", "index.html"), "utf8");
  const entries = [...page.matchAll(/<script[^>]+src="[^"]*\/_astro\/([^"]+\.js)"/gu)].map((match) => match[1] ?? "");
  const atOnce = closureOf(assets, entries);
  const later = laterChunks(assets, atOnce).map(({ chunk, loaded }) => ({
    chunk: `${chunk}${languageOf(readFileSync(join(assets, chunk), "utf8"))}`,
    size: sum([...closureOf(assets, [chunk])].filter((each) => !loaded.has(each)).map((each) => sizeOf(join(assets, each)))),
  }));
  const playground = join(dist, "playground");
  return [
    `${"".padEnd(56)} ${"bytes".padStart(10)} ${"gzip".padStart(10)}`,
    line("page: scripts loaded at once", sum([...atOnce].map((chunk) => sizeOf(join(assets, chunk))))),
    ...later.map(({ chunk, size }) => line(`later: ${chunk}`, size)),
    ...filesUnder(join(playground, "files")).map((path) => line(`files: ${path.slice(playground.length + 1)}`, sizeOf(path))),
    line("kuromoji dictionary (Japanese only, *.dat.gz)", sum(filesUnder(join(playground, "kuromoji")).map(sizeOf))),
  ];
};

const dist = process.argv[2];
if (dist === undefined) {
  console.error("usage: node scripts/browser-size.ts <site dist>");
  process.exitCode = 2;
} else {
  console.log(report(dist).join("\n"));
}
