// Fetches the documents in corpus/manifest.json. Japanese statutes come from the e-Gov law API (v2), UK Acts from
// legislation.gov.uk; each is written to corpus/laws/<id>.txt with the revision it came from, so a test run never
// touches the network. Documents of other kinds come from a pinned URL: committed under corpus/docs/ when they may be
// redistributed, otherwise into the git-ignored corpus/.cache/.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { lawText } from "./law-text.ts";
import { ukText } from "./uk-text.ts";
import { docEntries, docPath, type DocEntry } from "./corpus-docs.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "corpus");
const TIMEOUT_MS = 120_000;
const PAUSE_MS = 1_000;

type Entry = {
  readonly id: string;
  readonly title: string;
  readonly source: string;
  readonly lawId?: string;
  readonly path?: string;
  readonly redistribute: boolean;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const isEntry = (value: unknown): value is Entry =>
  isRecord(value) &&
  typeof value["id"] === "string" &&
  typeof value["title"] === "string" &&
  typeof value["source"] === "string" &&
  typeof value["redistribute"] === "boolean";

const fetchText = async (url: string): Promise<string> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
    return await response.text();
  } catch (err) {
    throw new Error(`${url}: ${err instanceof Error ? err.message : String(err)}`, { cause: err });
  } finally {
    clearTimeout(timer);
  }
};

const fetchLaw = async (entry: Entry): Promise<void> => {
  const url = `https://laws.e-gov.go.jp/api/2/law_data/${entry.lawId ?? ""}?law_full_text_format=xml`;
  const data: unknown = JSON.parse(await fetchText(url));
  if (!isRecord(data) || typeof data["law_full_text"] !== "string") throw new Error(`${url}: no law_full_text`);
  const info = data["revision_info"];
  const revision = isRecord(info) && typeof info["law_revision_id"] === "string" ? info["law_revision_id"] : "";
  const xml = Buffer.from(data["law_full_text"], "base64").toString("utf8");
  const out = join(ROOT, "laws", `${entry.id}.txt`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, lawText(xml));
  writeFileSync(join(ROOT, "laws", `${entry.id}.revision`), `${revision}\n`);
  console.log(`${entry.id}  ${entry.title}  ${revision}`);
};

/** legislation.gov.uk: the latest revised XML; the revision is its dct:modified date. */
const fetchUkAct = async (entry: Entry): Promise<void> => {
  const url = `https://www.legislation.gov.uk/${entry.path ?? ""}/data.xml`;
  const xml = await fetchText(url);
  const modified = /<dc:modified>([^<]+)<\/dc:modified>/u.exec(xml)?.[1] ?? "";
  writeFileSync(join(ROOT, "laws", `${entry.id}.txt`), ukText(xml));
  writeFileSync(join(ROOT, "laws", `${entry.id}.revision`), `${entry.path ?? ""} ${modified}\n`);
  console.log(`${entry.id}  ${entry.title}  ${modified}`);
};

const fetchDoc = async (doc: DocEntry): Promise<void> => {
  const out = docPath(ROOT, doc);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, await fetchText(doc.url));
  console.log(`${doc.id}  ${doc.title}  ${doc.redistribute ? "committed" : "cached"}`);
};

const FETCHERS: Readonly<Record<string, (entry: Entry) => Promise<void>>> = { "e-gov": fetchLaw, "legislation.gov.uk": fetchUkAct };

const manifest: unknown = JSON.parse(readFileSync(join(ROOT, "manifest.json"), "utf8"));
const entries = isRecord(manifest) && Array.isArray(manifest["documents"]) ? manifest["documents"].filter(isEntry) : [];
const only = process.argv.slice(2);
const chosen = entries.filter((entry) => FETCHERS[entry.source] !== undefined && (only.length === 0 || only.includes(entry.id)));
await chosen.reduce<Promise<void>>(async (previous, entry) => {
  await previous;
  await FETCHERS[entry.source]?.(entry);
  await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
}, Promise.resolve());
const docs = docEntries(manifest).filter((doc) => only.length === 0 || only.includes(doc.id));
await docs.reduce<Promise<void>>(async (previous, doc) => {
  await previous;
  await fetchDoc(doc);
  await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
}, Promise.resolve());
