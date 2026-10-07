import { checkCitations, isAnywhere, type Citation, type CitationResult } from "../structure/cite.ts";
import { readSource, readTree, type TreeContext } from "./tree.ts";
import type { Texts, UiLanguage } from "../ui.ts";

const FORMATS: ReadonlySet<string> = new Set(["text", "json"]);
const QUOTE_WIDTH = 40;
const VALUED: ReadonlySet<string> = new Set(["--format", "--language", "--genre"]);

export const citeTargets = (argv: readonly string[]): string[] =>
  argv.slice(1).filter((arg, index, all) => !arg.startsWith("--") && !VALUED.has(all[index - 1] ?? ""));

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

type RawCitation = { readonly address?: string; readonly quote: string };

const isRawCitation = (value: unknown): value is RawCitation =>
  isRecord(value) && (value["address"] === undefined || typeof value["address"] === "string") && typeof value["quote"] === "string";

const citationOf = (raw: RawCitation): Citation => ({ address: raw.address ?? "", quote: raw.quote });

/** Neither an address nor a quote: saying ✓ would pass an entry nobody filled in. */
const isEmpty = (citation: Citation): boolean => isAnywhere(citation) && citation.quote.trim() === "";

export type ParsedCitations = { readonly citations: readonly Citation[] } | { readonly error: string };

const parseJson = (text: string, ui: UiLanguage): { readonly value: unknown } | { readonly error: string } => {
  try {
    return { value: JSON.parse(text) };
  } catch (err) {
    return { error: TEXT[ui].notJson(err instanceof Error ? err.message : String(err)) };
  }
};

/** 引用の一覧。[{ address?, quote }] の配列だけを受け取る。address を省けば原文のどこか。形が違えば理由を返す。 */
export const parseCitations = (text: string, ui: UiLanguage = "ja"): ParsedCitations => {
  const parsed = parseJson(text, ui);
  if ("error" in parsed) return parsed;
  if (!Array.isArray(parsed.value)) return { error: TEXT[ui].notArray };
  const entries: readonly unknown[] = parsed.value;
  const bad = entries.findIndex((entry) => !isRawCitation(entry));
  if (bad !== -1) return { error: TEXT[ui].badEntry(bad + 1) };
  const citations = entries.filter(isRawCitation).map(citationOf);
  const empty = citations.findIndex(isEmpty);
  if (empty !== -1) return { error: TEXT[ui].emptyEntry(empty + 1) };
  return { citations };
};

type CiteText = {
  readonly usage: string;
  readonly quoted: (text: string) => string;
  readonly notJson: (why: string) => string;
  readonly notArray: string;
  readonly badEntry: (n: number) => string;
  readonly emptyEntry: (n: number) => string;
  readonly anywhere: string;
  readonly foundAt: (parts: readonly string[]) => string;
  readonly line: (line: number) => string;
  readonly results: Readonly<Record<CitationResult["status"], (result: CitationResult) => string>>;
};

const TEXT: Texts<CiteText> = {
  ja: {
    quoted: (text) => `「${text}」`,
    usage: "使い方: chaff cite <原文> <引用.json> [--format text|json] [--language ja|en|…]",
    notJson: (why) => `JSON として読めません: ${why}`,
    notArray: '引用は配列で渡してください: [{ "address": "3.2", "quote": "…" }]',
    badEntry: (n) => `${String(n)} 件目に quote（文字列）が無いか、address が文字列ではありません`,
    emptyEntry: (n) => `${String(n)} 件目は address も quote も空で、確かめることがありません`,
    anywhere: "（番地なし）",
    foundAt: (parts) => `（${parts.join("、")}）`,
    line: (line) => `${String(line)} 行目`,
    results: {
      ok: () => "一致",
      "missing-address": (result) => `番地 ${result.citation.address} は原文にありません`,
      "quote-elsewhere": (result) =>
        `引用文は ${result.citation.address} ではなく ${result.foundAt ?? "番地の外"}（${String(result.line ?? "?")} 行目）にあります`,
      "quote-not-found": () => "引用文が原文のどこにもありません",
    },
  },
  en: {
    quoted: (text) => ` "${text}"`,
    usage: "usage: chaff cite <source> <quotes.json> [--format text|json] [--language ja|en|…]",
    notJson: (why) => `Not valid JSON: ${why}`,
    notArray: 'Give the quotations as an array: [{ "address": "3.2", "quote": "…" }]',
    badEntry: (n) => `Entry ${String(n)} needs quote (a string), and an address, if it has one, must be a string`,
    emptyEntry: (n) => `Entry ${String(n)} has neither an address nor a quote, so there is nothing to check`,
    anywhere: "(anywhere)",
    foundAt: (parts) => ` (${parts.join(", ")})`,
    line: (line) => `line ${String(line)}`,
    results: {
      ok: () => "matches",
      "missing-address": (result) => `address ${result.citation.address} is not in the source`,
      "quote-elsewhere": (result) =>
        `the quotation is not at ${result.citation.address} but at ${result.foundAt ?? "no address"} (line ${String(result.line ?? "?")})`,
      "quote-not-found": () => "the quotation is nowhere in the source",
    },
  },
};

/** Where a quote given no address was found, so the reader can write the address in. */
const whereFound = (result: CitationResult, text: CiteText): string => {
  if (result.status !== "ok" || !isAnywhere(result.citation) || result.line === undefined) return "";
  return text.foundAt([...(result.foundAt === undefined ? [] : [result.foundAt]), text.line(result.line)]);
};

const describe = (result: CitationResult, text: CiteText): string => {
  const mark = result.status === "ok" ? "✓" : "✗";
  const oneLine = result.citation.quote.replace(/\s+/gu, " ").trim();
  const quote = oneLine.length > QUOTE_WIDTH ? `${oneLine.slice(0, QUOTE_WIDTH)}…` : oneLine;
  const address = isAnywhere(result.citation) ? text.anywhere : result.citation.address;
  return `${mark} ${address}${text.quoted(quote)}: ${text.results[result.status](result)}${whereFound(result, text)}`;
};

/**
 * 回答の引用が原文にあるかを確かめる。書き換えはしない。
 * 一つでも外れていれば 1 で終わるので、AI の回答を単体試験のように検査できる。
 */
export const runCite = async (targets: readonly string[], argv: readonly string[], context: TreeContext): Promise<number> => {
  const [sourcePath, citationsPath] = targets;
  const format = context.flag(argv, "--format") ?? "text";
  if (sourcePath === undefined || citationsPath === undefined || targets.length !== 2 || !FORMATS.has(format)) {
    console.error(TEXT[context.ui ?? "ja"].usage);
    return 1;
  }
  const citationsText = await readSource(citationsPath, context);
  if (citationsText === undefined) return 1;
  const parsed = parseCitations(citationsText, context.ui ?? "ja");
  if ("error" in parsed) {
    console.error(`${citationsPath}: ${parsed.error}`);
    return 1;
  }
  const read = await readTree(sourcePath, argv, context);
  if (read === undefined) return 1;
  const results = checkCitations(read.source, read.tree, parsed.citations);
  console.log(format === "json" ? JSON.stringify(results, null, 2) : results.map((result) => describe(result, TEXT[context.ui ?? "ja"])).join("\n"));
  return results.every((result) => result.status === "ok") ? 0 : 1;
};
