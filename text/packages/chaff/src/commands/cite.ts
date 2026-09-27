import { checkCitations, type Citation, type CitationResult } from "../structure/cite.ts";
import { readSource, readTree, type TreeContext } from "./tree.ts";
import type { Texts, UiLanguage } from "../ui.ts";

const FORMATS = ["text", "json"];
const QUOTE_WIDTH = 40;
const VALUED = ["--format", "--language"];

export const citeTargets = (argv: readonly string[]): string[] =>
  argv.slice(1).filter((arg, index, all) => !arg.startsWith("--") && !VALUED.includes(all[index - 1] ?? ""));

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const isCitation = (value: unknown): value is Citation => isRecord(value) && typeof value["address"] === "string" && typeof value["quote"] === "string";

export type ParsedCitations = { readonly citations: readonly Citation[] } | { readonly error: string };

const parseJson = (text: string, ui: UiLanguage): { readonly value: unknown } | { readonly error: string } => {
  try {
    return { value: JSON.parse(text) };
  } catch (err) {
    return { error: TEXT[ui].notJson(err instanceof Error ? err.message : String(err)) };
  }
};

/** 引用の一覧。[{ address, quote }] の配列だけを受け取る。形が違えば理由を返す。 */
export const parseCitations = (text: string, ui: UiLanguage = "ja"): ParsedCitations => {
  const parsed = parseJson(text, ui);
  if ("error" in parsed) return parsed;
  if (!Array.isArray(parsed.value)) return { error: TEXT[ui].notArray };
  const entries: readonly unknown[] = parsed.value;
  const bad = entries.findIndex((entry) => !isCitation(entry));
  if (bad !== -1) return { error: TEXT[ui].badEntry(bad + 1) };
  return { citations: entries.filter(isCitation).map((entry) => ({ address: entry.address, quote: entry.quote })) };
};

type CiteText = {
  readonly usage: string;
  readonly quoted: (text: string) => string;
  readonly notJson: (why: string) => string;
  readonly notArray: string;
  readonly badEntry: (n: number) => string;
  readonly results: Readonly<Record<CitationResult["status"], (result: CitationResult) => string>>;
};

const TEXT: Texts<CiteText> = {
  ja: {
    quoted: (text) => `「${text}」`,
    usage: "使い方: chaff cite <原文> <引用.json> [--format text|json] [--language ja|en|…]",
    notJson: (why) => `JSON として読めません: ${why}`,
    notArray: '引用は配列で渡してください: [{ "address": "3.2", "quote": "…" }]',
    badEntry: (n) => `${String(n)} 件目に address（文字列）と quote（文字列）がありません`,
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
    badEntry: (n) => `Entry ${String(n)} needs address (a string) and quote (a string)`,
    results: {
      ok: () => "matches",
      "missing-address": (result) => `address ${result.citation.address} is not in the source`,
      "quote-elsewhere": (result) =>
        `the quotation is not at ${result.citation.address} but at ${result.foundAt ?? "no address"} (line ${String(result.line ?? "?")})`,
      "quote-not-found": () => "the quotation is nowhere in the source",
    },
  },
};

const describe = (result: CitationResult, text: CiteText): string => {
  const mark = result.status === "ok" ? "✓" : "✗";
  const oneLine = result.citation.quote.replace(/\s+/gu, " ").trim();
  const quote = oneLine.length > QUOTE_WIDTH ? `${oneLine.slice(0, QUOTE_WIDTH)}…` : oneLine;
  return `${mark} ${result.citation.address}${text.quoted(quote)}: ${text.results[result.status](result)}`;
};

/**
 * 回答の引用が原文にあるかを確かめる。書き換えはしない。
 * 一つでも外れていれば 1 で終わるので、AI の回答を単体試験のように検査できる。
 */
export const runCite = async (targets: readonly string[], argv: readonly string[], context: TreeContext): Promise<number> => {
  const [sourcePath, citationsPath] = targets;
  const format = context.flag(argv, "--format") ?? "text";
  if (sourcePath === undefined || citationsPath === undefined || targets.length !== 2 || !FORMATS.includes(format)) {
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
