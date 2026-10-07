import { dirname, isAbsolute, join } from "node:path";
import { checkCitations, isAnywhere, type CitationResult } from "../structure/cite.ts";
import { bySource, parseCitations, sourceOf, sourceProblem, type Claim } from "./cite-claims.ts";
import { runScaffold } from "./cite-scaffold.ts";
import { readSource, readTree, type TreeContext } from "./tree.ts";
import type { Texts } from "../ui.ts";

const FORMATS: ReadonlySet<string> = new Set(["text", "json"]);
const QUOTE_WIDTH = 40;
const VALUED: ReadonlySet<string> = new Set(["--format", "--language", "--genre"]);

export const citeTargets = (argv: readonly string[]): string[] =>
  argv.slice(1).filter((arg, index, all) => !arg.startsWith("--") && !VALUED.has(all[index - 1] ?? ""));

type CiteText = {
  readonly usage: string;
  readonly quoted: (text: string) => string;
  readonly anywhere: string;
  readonly foundAt: (parts: readonly string[]) => string;
  readonly line: (line: number) => string;
  readonly results: Readonly<Record<CitationResult["status"], (result: CitationResult) => string>>;
};

const TEXT: Texts<CiteText> = {
  ja: {
    quoted: (text) => `「${text}」`,
    usage: [
      "使い方: chaff cite <原文> <引用.json> [--format text|json] [--language ja|en|…]",
      "        chaff cite <引用.json>            （引用ごとに source で原文を書いたとき）",
      "        chaff cite --scaffold <文書>      （出典の無い引用から引用.json のひな形を作る）",
    ].join("\n"),
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
    usage: [
      "usage: chaff cite <source> <quotes.json> [--format text|json] [--language ja|en|…]",
      "       chaff cite <quotes.json>             (each quotation names its source)",
      "       chaff cite --scaffold <document>     (a quotes.json to fill in, from the quotations with no source)",
    ].join("\n"),
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

/** A claim that names its own source says which, before its address. */
const sourcePrefix = (result: CitationResult): string => {
  const source = sourceOf(result.citation);
  return source === undefined ? "" : `${source} `;
};

const describe = (result: CitationResult, text: CiteText): string => {
  const mark = result.status === "ok" ? "✓" : "✗";
  const oneLine = result.citation.quote.replace(/\s+/gu, " ").trim();
  const quote = oneLine.length > QUOTE_WIDTH ? `${oneLine.slice(0, QUOTE_WIDTH)}…` : oneLine;
  const address = isAnywhere(result.citation) ? text.anywhere : result.citation.address;
  return `${mark} ${sourcePrefix(result)}${address}${text.quoted(quote)}: ${text.results[result.status](result)}${whereFound(result, text)}`;
};

/** Each claim checked against one source file. undefined when the file cannot be read as a tree (already said why). */
const checkAgainst = async (path: string, claims: readonly Claim[], argv: readonly string[], context: TreeContext): Promise<CitationResult[] | undefined> => {
  const read = await readTree(path, argv, context);
  return read === undefined ? undefined : checkCitations(read.source, read.tree, claims);
};

/** A claim's source, read from where the claims file is: a scaffold sits next to the document that quotes. */
const sourcePath = (claimsPath: string, source: string): string => {
  // A claims file written on Windows says sources\talk.md; it names the same file everywhere.
  const portable = source.replaceAll("\\", "/");
  return isAbsolute(portable) ? portable : join(dirname(claimsPath), portable);
};

/**
 * Each claim checked against the source it names, in the claims file's order. Sources are read one at a time, so what
 * an unreadable one prints comes in the same order every run; any unreadable source fails the run.
 */
const checkEachSource = async (
  claimsPath: string,
  claims: readonly Claim[],
  argv: readonly string[],
  context: TreeContext,
): Promise<CitationResult[] | undefined> => {
  const groups = bySource(claims);
  const checked = await groups.reduce<Promise<(CitationResult[] | undefined)[]>>(async (previous, group) => {
    const done = await previous;
    return [...done, await checkAgainst(sourcePath(claimsPath, group.source), group.claims, argv, context)];
  }, Promise.resolve([]));
  const byClaim = new Map<Claim, CitationResult>();
  const unread = groups.some((group, index) => {
    const results = checked[index];
    results?.forEach((result, at) => byClaim.set(group.claims[at] ?? result.citation, result));
    return results === undefined;
  });
  return unread ? undefined : claims.flatMap((claim) => byClaim.get(claim) ?? []);
};

const readClaims = async (claimsPath: string, sourceGiven: boolean, context: TreeContext): Promise<readonly Claim[] | undefined> => {
  const text = await readSource(claimsPath, context);
  if (text === undefined) return undefined;
  const ui = context.ui ?? "ja";
  const parsed = parseCitations(text, ui);
  const problem = "error" in parsed ? parsed.error : sourceProblem(parsed.citations, sourceGiven, ui);
  if (problem === undefined && "citations" in parsed) return parsed.citations;
  console.error(`${claimsPath}: ${problem ?? ""}`);
  return undefined;
};

const usageError = (text: CiteText): number => {
  console.error(text.usage);
  return 1;
};

/**
 * 回答の引用が原文にあるかを確かめる。書き換えはしない。原文は引数で一つ渡すか、引用ごとに source で書く。
 * 一つでも外れていれば 1 で終わるので、AI の回答を単体試験のように検査できる。
 */
export const runCite = async (targets: readonly string[], argv: readonly string[], context: TreeContext): Promise<number> => {
  const text = TEXT[context.ui ?? "ja"];
  const format = context.flag(argv, "--format") ?? "text";
  if (!FORMATS.has(format)) return usageError(text);
  // The scaffold is always JSON: it is a file to fill in.
  if (argv.includes("--scaffold")) return runScaffold(targets, argv, context, text.usage);
  const claimsPath = targets.at(-1);
  if (claimsPath === undefined || targets.length > 2) return usageError(text);
  const sourceGiven = targets.length === 2 ? targets[0] : undefined;
  const claims = await readClaims(claimsPath, sourceGiven !== undefined, context);
  if (claims === undefined) return 1;
  const results = sourceGiven === undefined ? await checkEachSource(claimsPath, claims, argv, context) : await checkAgainst(sourceGiven, claims, argv, context);
  if (results === undefined) return 1;
  console.log(format === "json" ? JSON.stringify(results, null, 2) : results.map((result) => describe(result, text)).join("\n"));
  return results.every((result) => result.status === "ok") ? 0 : 1;
};
