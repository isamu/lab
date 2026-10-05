import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { registerBrowserHooks, swappedModules } from "./browser-hooks.ts";
import { browserFiles, kuromojiDictionaryDir } from "../scripts/browser-files.ts";
import { docEntries, docPath } from "../scripts/corpus-docs.ts";

// chaffjs/browser against the command line: the same documents through `chaff grade` (a separate process, from dist) and
// through check() in this process, built as a bundler builds it for a page (browser-hooks.ts), with kuromoji's dictionary
// fetched over HTTP as a page fetches it. Every finding and every rule that did not run must be the same.

const TEXT = join(import.meta.dirname, "..");
const CLI = join(TEXT, "packages", "chaff", "bin", "chaff.js");

type Document = { readonly id: string; readonly text: string; readonly language?: string; readonly genre?: string };

const benchSamples = (language: string): Document[] =>
  readdirSync(join(TEXT, "test", "fixtures", "bench", language))
    .filter((file) => file.endsWith(".md"))
    .toSorted((left, right) => left.localeCompare(right, "en"))
    .map((file) => ({ id: `bench/${language}/${file}`, text: readFileSync(join(TEXT, "test", "fixtures", "bench", language, file), "utf8") }));

/** Every few committed corpus documents, by id: both languages and many genres, as the corpus labels them. */
const CORPUS_STEP = 9;

const corpusDocuments = (): Document[] =>
  docEntries(JSON.parse(readFileSync(join(TEXT, "corpus", "manifest.json"), "utf8")))
    .filter((entry) => entry.redistribute)
    .toSorted((left, right) => left.id.localeCompare(right.id, "en"))
    .filter((_, index) => index % CORPUS_STEP === 0)
    .map((entry) => ({
      id: `corpus/${entry.id}`,
      text: readFileSync(docPath(join(TEXT, "corpus"), entry), "utf8"),
      language: entry.language,
      genre: entry.genre,
    }));

const DOCUMENTS: readonly Document[] = [...benchSamples("ja"), ...benchSamples("en"), ...corpusDocuments()];

/** grade's own checks besides the rules: a browser check has none of them to report. */
const GRADE_ONLY = new Set(["compare", "cite", "contexts"]);

type Comparable = { readonly language: string; readonly genre: string; readonly findings: unknown; readonly notRun: unknown };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const fromGrade = (line: string): [string, Comparable] => {
  const result: unknown = JSON.parse(line);
  if (!isRecord(result) || typeof result["id"] !== "string" || !Array.isArray(result["notRun"])) throw new Error(`not a grade result: ${line.slice(0, 200)}`);
  const notRun: unknown[] = result["notRun"];
  return [
    result["id"],
    {
      language: String(result["language"]),
      genre: String(result["genre"]),
      findings: result["findings"],
      notRun: notRun.filter((entry) => !(isRecord(entry) && GRADE_ONLY.has(String(entry["rule"])))),
    },
  ];
};

const gradedByCli = (): Map<string, Comparable> => {
  const dir = mkdtempSync(join(tmpdir(), "chaff-browser-"));
  const items = DOCUMENTS.map((doc) => JSON.stringify({ id: doc.id, output: doc.text, language: doc.language, genre: doc.genre }));
  writeFileSync(join(dir, "items.jsonl"), `${items.join("\n")}\n`);
  const run = spawnSync(process.execPath, [CLI, "grade", "items.jsonl", "--out", "results.jsonl"], {
    cwd: dir,
    encoding: "utf8",
    env: { ...process.env, LANG: "en_US.UTF-8" },
  });
  assert.notEqual(run.status, 2, run.stderr);
  const lines = readFileSync(join(dir, "results.jsonl"), "utf8")
    .split("\n")
    .filter((line) => line !== "");
  return new Map(lines.map(fromGrade));
};

/** The dictionary files the page fetched. */
const fetched = new Set<string>();

const serveDictionary = async (): Promise<{ readonly server: Server; readonly url: string }> => {
  const dir = kuromojiDictionaryDir();
  const server = createServer((request, response) => {
    const name = (request.url ?? "").replace(/^\/+/u, "");
    fetched.add(name);
    try {
      // As GitHub Pages serves a .gz file, and as astro preview does (already unpacked on arrival): one file each way.
      const encoded = fetched.size % 2 === 0 ? { "content-encoding": "gzip" } : {};
      response.writeHead(200, { "content-type": "application/gzip", ...encoded }).end(readFileSync(join(dir, name)));
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") throw new Error("the dictionary server has no port");
  return { server, url: `http://127.0.0.1:${String(address.port)}/` };
};

describe("chaffjs/browser finds what the command line finds", () => {
  const state: { server?: Server } = {};
  after(() => state.server?.close());

  const checkedInBrowser = new Map<string, Comparable>();
  /** The packages whose files the page asked for, in order. */
  const asked: string[] = [];
  before(async () => {
    registerBrowserHooks();
    const dictionary = await serveDictionary();
    state.server = dictionary.server;
    const files = browserFiles();
    const browser = await import("../packages/chaff/src/browser.ts");
    browser.setupBrowser({
      files: (name) => {
        asked.push(name);
        return Promise.resolve(files[name] ?? {});
      },
      kuromojiDictionaryUrl: dictionary.url,
    });
    for (const doc of DOCUMENTS) {
      const result = await browser.check(doc.text, { language: doc.language, genre: doc.genre, path: "output.md" });
      checkedInBrowser.set(doc.id, {
        language: result.language,
        genre: result.genre,
        findings: result.findings.map(({ rule, level, line, column, message }) => ({ rule, level, line, column, message })),
        notRun: result.notRun,
      });
    }
  });

  it("checks Japanese and English documents, with findings to compare", () => {
    const results = [...checkedInBrowser.values()];
    assert.ok(results.some((result) => result.language === "ja") && results.some((result) => result.language === "en"));
    assert.ok(results.filter((result) => Array.isArray(result.findings) && result.findings.length > 0).length > DOCUMENTS.length / 2);
  });

  it("runs what a bundle runs: each package's files asked for once, the dictionary fetched, the browser modules in place", () => {
    assert.deepEqual(
      asked.toSorted((left, right) => left.localeCompare(right, "en")),
      ["@chaffjs/lang-en", "@chaffjs/lang-ja", "chaffjs"],
    );
    assert.deepEqual(
      [...fetched].toSorted((left, right) => left.localeCompare(right, "en")),
      readdirSync(kuromojiDictionaryDir()).toSorted((left, right) => left.localeCompare(right, "en")),
    );
    assert.deepEqual(
      swappedModules().filter((path) => path.startsWith("packages/")),
      [
        "packages/chaff/dist/browser/path.js",
        "packages/chaff/src/browser/adapter-import.ts",
        "packages/chaff/src/browser/bounded-match.ts",
        "packages/chaff/src/browser/package-files.ts",
        "packages/chaff/src/browser/working-dir.ts",
        "packages/lang-en/dist/browser/package-files.js",
        "packages/lang-en/dist/browser/wink-modules.js",
        "packages/lang-ja/dist/browser/kuromoji-module.js",
        "packages/lang-ja/dist/browser/package-files.js",
      ],
    );
  });

  it("gives every document the same language, genre, findings and rules not run as chaff grade", () => {
    const cli = gradedByCli();
    assert.equal(cli.size, DOCUMENTS.length);
    DOCUMENTS.forEach((doc) => assert.deepEqual(checkedInBrowser.get(doc.id), cli.get(doc.id), doc.id));
  });
});
