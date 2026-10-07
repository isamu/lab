import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fetchPage, HttpStatusError, type Fetcher } from "../packages/chaff/src/html/fetch-page.ts";
import { pageDocument } from "../packages/chaff/src/html/page-document.ts";
import { citeTargets, runCite } from "../packages/chaff/src/commands/cite.ts";
import { EMPTY } from "../packages/chaff/src/config/load.ts";

// chaff cite --url: a quotation checked against a web page. The network is never reached: every fetch is a stand-in.

const URL_TALK = "https://example.com/talk";

const PAGE = [
  "<!doctype html><html><head><title>Talk</title></head><body><main>",
  "<h1>Talk</h1>",
  "<h2>Changes</h2><p>Most outages start with a change nobody reviewed.</p>",
  "<h2>Rollbacks</h2><p>A rollback you have never run is not a rollback &mdash; run it.</p>",
  "</main></body></html>",
].join("\n");

/** A fetch that answers every URL with one body, and records what was asked for. */
const answering = (body: string, contentType: string | null, status = 200): { readonly fetcher: Fetcher; readonly asked: string[] } => {
  const asked: string[] = [];
  const fetcher: Fetcher = (url) => {
    asked.push(url);
    const headers = contentType === null ? {} : { "content-type": contentType };
    return Promise.resolve(new Response(body, { status, headers }));
  };
  return { fetcher, asked };
};

describe("pageDocument", () => {
  it("reads HTML as Markdown, so its headings become addresses", () => {
    const page = pageDocument("text/html; charset=utf-8", PAGE);
    assert.ok("text" in page);
    assert.equal(page.path, "page.md");
    assert.match(page.text, /^## Rollbacks$/mu);
    assert.match(page.text, /never run is not a rollback — run it\./u);
  });

  const cases: readonly (readonly [string, string | null, string, string])[] = [
    ["XHTML is HTML", "application/xhtml+xml", "<html><body><p>Words here.</p></body></html>", "page.md"],
    ["no Content-Type and a body that opens like HTML", null, "<!DOCTYPE html><html><body><p>Words.</p></body></html>", "page.md"],
    ["Markdown as it is", "text/markdown", "# Title\n\nWords.\n", "page.md"],
    ["plain text as it is", "text/plain", "Words.\n", "page.txt"],
    ["no Content-Type and no markup", null, "Words.\n", "page.txt"],
    ["upper case and parameters in the type", "TEXT/PLAIN; charset=UTF-8", "Words.\n", "page.txt"],
  ];
  cases.forEach(([name, type, body, path]) => {
    it(name, () => {
      const page = pageDocument(type, body);
      assert.ok("path" in page, JSON.stringify(page));
      assert.equal(page.path, path);
    });
  });

  it("refuses what is not text", () => {
    assert.deepEqual(pageDocument("application/pdf", "%PDF-1.7"), { unsupported: "application/pdf" });
    assert.deepEqual(pageDocument("image/png", ""), { unsupported: "image/png" });
  });
});

describe("fetchPage", () => {
  it("gives the text and its Content-Type", async () => {
    const { fetcher, asked } = answering("Words.", "text/plain");
    assert.deepEqual(await fetchPage(URL_TALK, { timeout_ms: 1000 }, fetcher), { text: "Words.", contentType: "text/plain" });
    assert.deepEqual(asked, [URL_TALK]);
  });

  it("decodes the encoding the page declares", async () => {
    const shiftJis = new Uint8Array([0x93, 0xfa, 0x96, 0x7b]);
    const fetcher: Fetcher = () => Promise.resolve(new Response(shiftJis, { headers: { "content-type": "text/plain; charset=shift_jis" } }));
    assert.equal((await fetchPage(URL_TALK, { timeout_ms: 1000 }, fetcher)).text, "日本");
  });

  it("an HTTP error names the URL and keeps the status as the cause", async () => {
    const { fetcher } = answering("gone", "text/plain", 404);
    const error = await fetchPage(URL_TALK, { timeout_ms: 1000 }, fetcher).catch((err: unknown) => err);
    assert.ok(error instanceof Error);
    assert.equal(error.message, `${URL_TALK}: HTTP 404`);
    assert.ok(error.cause instanceof HttpStatusError && error.cause.status === 404);
  });

  it("gives up after the timeout, and says which URL", async () => {
    const hanging: Fetcher = (_url, init) => new Promise((_resolve, reject) => init.signal.addEventListener("abort", () => reject(new Error("aborted"))));
    const error = await fetchPage(URL_TALK, { timeout_ms: 10 }, hanging).catch((err: unknown) => err);
    assert.ok(error instanceof Error);
    assert.equal(error.message, `${URL_TALK}: aborted`);
  });

  it("refuses a body longer than the limit while reading it, and names the URL", async () => {
    const pulled: number[] = [];
    const chunk = new Uint8Array(10).fill(0x61);
    const endless = new ReadableStream<Uint8Array>({
      pull: (controller) => {
        pulled.push(chunk.byteLength);
        controller.enqueue(chunk);
      },
    });
    const fetcher: Fetcher = () => Promise.resolve(new Response(endless, { headers: { "content-type": "text/plain" } }));
    await assert.rejects(fetchPage(URL_TALK, { timeout_ms: 1000, max_bytes: 25 }, fetcher), { message: `${URL_TALK}: the page is larger than 25 bytes` });
    assert.ok(pulled.length <= 4, `read ${String(pulled.length)} chunks`);
  });

  it("refuses at once a body whose Content-Length is over the limit", async () => {
    const fetcher: Fetcher = () => Promise.resolve(new Response("a".repeat(30), { headers: { "content-type": "text/plain", "content-length": "30" } }));
    await assert.rejects(fetchPage(URL_TALK, { timeout_ms: 1000, max_bytes: 25 }, fetcher), { message: `${URL_TALK}: the page is larger than 25 bytes` });
  });

  it("a body exactly at the limit is read", async () => {
    const fetcher: Fetcher = () => Promise.resolve(new Response("a".repeat(25), { headers: { "content-type": "text/plain" } }));
    assert.equal((await fetchPage(URL_TALK, { timeout_ms: 1000, max_bytes: 25 }, fetcher)).text, "a".repeat(25));
  });

  it("a network failure names the URL", async () => {
    const failing: Fetcher = () => Promise.reject(new TypeError("fetch failed"));
    await assert.rejects(fetchPage(URL_TALK, { timeout_ms: 1000 }, failing), { message: `${URL_TALK}: fetch failed` });
  });
});

describe("chaff cite --url", () => {
  const dir = mkdtempSync(join(tmpdir(), "chaff-cite-url-"));
  const flag = (argv: readonly string[], name: string): string | undefined => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined);

  const run = async (claims: unknown, argv: readonly string[], fetcher: Fetcher): Promise<{ readonly code: number; readonly out: string }> => {
    const path = join(dir, "claims.json");
    writeFileSync(path, JSON.stringify(claims));
    const out: string[] = [];
    const saved = { log: console.log, error: console.error };
    console.log = (text: string) => out.push(text);
    console.error = (text: string) => out.push(text);
    const context = { config: { ...EMPTY, language: "en", baseDir: dir }, flag, ui: "en" as const, fetcher };
    const full = ["cite", ...argv, path];
    try {
      return { code: await runCite(citeTargets(full), full, context), out: out.join("\n") };
    } finally {
      console.log = saved.log;
      console.error = saved.error;
    }
  };

  it("checks quotations against the page, by its headings' addresses or anywhere", async () => {
    const { fetcher, asked } = answering(PAGE, "text/html");
    const { code, out } = await run(
      [
        { address: "h1.2", quote: "never run is not a rollback" },
        { quote: "Most outages start with a change nobody reviewed." },
        { address: "h1.1", quote: "never run is not a rollback" },
      ],
      ["--url", URL_TALK],
      fetcher,
    );
    assert.equal(code, 1);
    assert.deepEqual(out.split("\n"), [
      '✓ h1.2 "never run is not a rollback": matches',
      '✓ (anywhere) "Most outages start with a change nobody …": matches (h1.1, line 5)',
      '✗ h1.1 "never run is not a rollback": the quotation is not at h1.1 but at h1.2 (line 9)',
    ]);
    assert.deepEqual(asked, [URL_TALK]);
  });

  it("the same page gives the same result every time", async () => {
    const claims = [{ quote: "A rollback you have never run" }];
    const first = await run(claims, ["--url", URL_TALK], answering(PAGE, "text/html").fetcher);
    const second = await run(claims, ["--url", URL_TALK], answering(PAGE, "text/html").fetcher);
    assert.deepEqual(first, second);
  });

  it("a claim whose source is a URL fetches that page", async () => {
    const { fetcher, asked } = answering(PAGE, "text/html");
    const { code } = await run([{ source: URL_TALK, quote: "nobody reviewed" }], [], fetcher);
    assert.equal(code, 0);
    assert.deepEqual(asked, [URL_TALK]);
  });

  it("1, naming the URL, when the page cannot be fetched", async () => {
    const { code, out } = await run([{ quote: "anything" }], ["--url", URL_TALK], answering("", "text/plain", 503).fetcher);
    assert.equal(code, 1);
    assert.equal(out, `Could not fetch the page: ${URL_TALK}: HTTP 503`);
  });

  it("1 when the page is not text", async () => {
    const { code, out } = await run([{ quote: "anything" }], ["--url", URL_TALK], answering("%PDF", "application/pdf").fetcher);
    assert.equal(code, 1);
    assert.match(out, /application\/pdf cannot be read as a text document/u);
  });

  it("the usage, and no fetch, for --url without a web address or with a source file as well", async () => {
    const { fetcher, asked } = answering(PAGE, "text/html");
    assert.equal((await run([{ quote: "x" }], ["--url", "talk.html"], fetcher)).code, 1);
    const both = await run([{ quote: "x" }], ["--url", URL_TALK, join(dir, "other.md")], fetcher);
    assert.equal(both.code, 1);
    assert.match(both.out, /^usage:/u);
    assert.deepEqual(asked, []);
  });

  it("the address after --url is not read as a file to check", () => {
    assert.deepEqual(citeTargets(["cite", "--url", URL_TALK, "claims.json"]), ["claims.json"]);
  });

  it("--scaffold with --url is the usage: a scaffold reads a document, not a page", async () => {
    const { fetcher, asked } = answering(PAGE, "text/html");
    const { code, out } = await run([{ quote: "x" }], ["--scaffold", "--url", URL_TALK], fetcher);
    assert.equal(code, 1);
    assert.match(out, /^usage:/u);
    assert.deepEqual(asked, []);
  });

  it("a claim naming its own source with --url is refused before anything is fetched", async () => {
    const { fetcher, asked } = answering(PAGE, "text/html");
    const { code, out } = await run([{ source: "talk.md", quote: "x" }], ["--url", URL_TALK], fetcher);
    assert.equal(code, 1);
    assert.match(out, /Entry 1 names a source/u);
    assert.deepEqual(asked, []);
  });
});
