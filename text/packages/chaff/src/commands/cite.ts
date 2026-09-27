import { checkCitations, type Citation, type CitationResult } from "../structure/cite.ts";
import { readSource, readTree, type TreeContext } from "./tree.ts";

const USAGE = "使い方: chaff cite <原文> <引用.json> [--format text|json] [--language ja|en|…]";
const FORMATS = ["text", "json"];
const QUOTE_WIDTH = 40;
const VALUED = ["--format", "--language"];

export const citeTargets = (argv: readonly string[]): string[] =>
  argv.slice(1).filter((arg, index, all) => !arg.startsWith("--") && !VALUED.includes(all[index - 1] ?? ""));

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const isCitation = (value: unknown): value is Citation => isRecord(value) && typeof value["address"] === "string" && typeof value["quote"] === "string";

export type ParsedCitations = { readonly citations: readonly Citation[] } | { readonly error: string };

const parseJson = (text: string): { readonly value: unknown } | { readonly error: string } => {
  try {
    return { value: JSON.parse(text) };
  } catch (err) {
    return { error: `JSON として読めません: ${err instanceof Error ? err.message : String(err)}` };
  }
};

/** 引用の一覧。[{ address, quote }] の配列だけを受け取る。形が違えば理由を返す。 */
export const parseCitations = (text: string): ParsedCitations => {
  const parsed = parseJson(text);
  if ("error" in parsed) return parsed;
  if (!Array.isArray(parsed.value)) return { error: '引用は配列で渡してください: [{ "address": "3.2", "quote": "…" }]' };
  const entries: readonly unknown[] = parsed.value;
  const bad = entries.findIndex((entry) => !isCitation(entry));
  if (bad !== -1) return { error: `${String(bad + 1)} 件目に address（文字列）と quote（文字列）がありません` };
  return { citations: entries.filter(isCitation).map((entry) => ({ address: entry.address, quote: entry.quote })) };
};

const MESSAGES: Readonly<Record<CitationResult["status"], (result: CitationResult) => string>> = {
  ok: () => "一致",
  "missing-address": (result) => `番地 ${result.citation.address} は原文にありません`,
  "quote-elsewhere": (result) => `引用文は ${result.citation.address} ではなく ${result.foundAt ?? "番地の外"}（${String(result.line ?? "?")} 行目）にあります`,
  "quote-not-found": () => "引用文が原文のどこにもありません",
};

const describe = (result: CitationResult): string => {
  const mark = result.status === "ok" ? "✓" : "✗";
  const oneLine = result.citation.quote.replace(/\s+/gu, " ").trim();
  const quote = oneLine.length > QUOTE_WIDTH ? `${oneLine.slice(0, QUOTE_WIDTH)}…` : oneLine;
  return `${mark} ${result.citation.address}「${quote}」: ${MESSAGES[result.status](result)}`;
};

/**
 * 回答の引用が原文にあるかを確かめる。書き換えはしない。
 * 一つでも外れていれば 1 で終わるので、AI の回答を単体試験のように検査できる。
 */
export const runCite = async (targets: readonly string[], argv: readonly string[], context: TreeContext): Promise<number> => {
  const [sourcePath, citationsPath] = targets;
  const format = context.flag(argv, "--format") ?? "text";
  if (sourcePath === undefined || citationsPath === undefined || targets.length !== 2 || !FORMATS.includes(format)) {
    console.error(USAGE);
    return 1;
  }
  const citationsText = await readSource(citationsPath);
  if (citationsText === undefined) return 1;
  const parsed = parseCitations(citationsText);
  if ("error" in parsed) {
    console.error(`${citationsPath}: ${parsed.error}`);
    return 1;
  }
  const read = await readTree(sourcePath, argv, context);
  if (read === undefined) return 1;
  const results = checkCitations(read.source, read.tree, parsed.citations);
  console.log(format === "json" ? JSON.stringify(results, null, 2) : results.map(describe).join("\n"));
  return results.every((result) => result.status === "ok") ? 0 : 1;
};
