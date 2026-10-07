// The claims file `chaff cite` reads: [{ source?, address?, quote }]. Pure: the shape is checked and every problem named,
// so a half-filled file (a scaffold with a source left empty) stops with a reason instead of passing.
import { isAnywhere, type Citation } from "../structure/cite.ts";
import type { Texts, UiLanguage } from "../ui.ts";

/** A citation and, when the claims file names it, the source it quotes: a file path, relative to the claims file. */
export type Claim = Citation & { readonly source?: string };

export type ParsedCitations = { readonly citations: readonly Claim[] } | { readonly error: string };

type RawClaim = { readonly source?: string; readonly address?: string; readonly quote: string };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const isOptionalString = (value: unknown): boolean => value === undefined || typeof value === "string";

const isRawClaim = (value: unknown): value is RawClaim =>
  isRecord(value) && isOptionalString(value["address"]) && isOptionalString(value["source"]) && typeof value["quote"] === "string";

const claimOf = (raw: RawClaim): Claim => ({
  ...(raw.source === undefined ? {} : { source: raw.source }),
  address: raw.address ?? "",
  quote: raw.quote,
});

/** Neither an address nor a quote: saying ✓ would pass an entry nobody filled in. */
const isEmpty = (claim: Claim): boolean => isAnywhere(claim) && claim.quote.trim() === "";

/** The source a claim names, or undefined when it names none (missing, empty or blank). */
export const sourceOf = (claim: Claim): string | undefined => {
  const source = claim.source?.trim() ?? "";
  return source === "" ? undefined : source;
};

type ClaimsText = {
  readonly notJson: (why: string) => string;
  readonly notArray: string;
  readonly badEntry: (n: number) => string;
  readonly emptyEntry: (n: number) => string;
  readonly noSource: (n: number) => string;
  readonly twoSources: (n: number) => string;
};

export const CLAIMS_TEXT: Texts<ClaimsText> = {
  ja: {
    notJson: (why) => `JSON として読めません: ${why}`,
    notArray: '引用は配列で渡してください: [{ "address": "3.2", "quote": "…" }]',
    badEntry: (n) => `${String(n)} 件目に quote（文字列）が無いか、address か source が文字列ではありません`,
    emptyEntry: (n) => `${String(n)} 件目は address も quote も空で、確かめることがありません`,
    noSource: (n) => `${String(n)} 件目に source がありません。原文を引数で渡さないときは、どの引用にも source（原文のファイル）を書いてください`,
    twoSources: (n) => `${String(n)} 件目が source を書いていますが、原文も引数で渡されています。どちらか一方にしてください`,
  },
  en: {
    notJson: (why) => `Not valid JSON: ${why}`,
    notArray: 'Give the quotations as an array: [{ "address": "3.2", "quote": "…" }]',
    badEntry: (n) => `Entry ${String(n)} needs quote (a string), and its address and source, if it has them, must be strings`,
    emptyEntry: (n) => `Entry ${String(n)} has neither an address nor a quote, so there is nothing to check`,
    noSource: (n) => `Entry ${String(n)} has no source. Without a source on the command line, every quotation needs one (the source's file)`,
    twoSources: (n) => `Entry ${String(n)} names a source, and a source was also given on the command line. Give one or the other`,
  },
};

const parseJson = (text: string, ui: UiLanguage): { readonly value: unknown } | { readonly error: string } => {
  try {
    return { value: JSON.parse(text) };
  } catch (err) {
    return { error: CLAIMS_TEXT[ui].notJson(err instanceof Error ? err.message : String(err)) };
  }
};

/** 引用の一覧。[{ source?, address?, quote }] の配列だけを受け取る。address を省けば原文のどこか。形が違えば理由を返す。 */
export const parseCitations = (text: string, ui: UiLanguage = "ja"): ParsedCitations => {
  const parsed = parseJson(text, ui);
  if ("error" in parsed) return parsed;
  if (!Array.isArray(parsed.value)) return { error: CLAIMS_TEXT[ui].notArray };
  const entries: readonly unknown[] = parsed.value;
  const bad = entries.findIndex((entry) => !isRawClaim(entry));
  if (bad !== -1) return { error: CLAIMS_TEXT[ui].badEntry(bad + 1) };
  const citations = entries.filter(isRawClaim).map(claimOf);
  const empty = citations.findIndex(isEmpty);
  if (empty !== -1) return { error: CLAIMS_TEXT[ui].emptyEntry(empty + 1) };
  return { citations };
};

/**
 * Where each claim's source comes from. With a source on the command line, no claim may name its own; without one,
 * every claim must. undefined when the claims agree with how cite was called, otherwise the reason.
 */
export const sourceProblem = (claims: readonly Claim[], sourceGiven: boolean, ui: UiLanguage): string | undefined => {
  const at = claims.findIndex((claim) => (sourceOf(claim) === undefined) !== sourceGiven);
  if (at === -1) return undefined;
  return sourceGiven ? CLAIMS_TEXT[ui].twoSources(at + 1) : CLAIMS_TEXT[ui].noSource(at + 1);
};

/** The claims of each source, in the order the sources first appear. Every claim names its source (sourceProblem passed). */
export const bySource = (claims: readonly Claim[]): { readonly source: string; readonly claims: readonly Claim[] }[] => {
  const groups = new Map<string, Claim[]>();
  claims.forEach((claim) => {
    const source = sourceOf(claim) ?? "";
    groups.set(source, [...(groups.get(source) ?? []), claim]);
  });
  return [...groups].map(([source, own]) => ({ source, claims: own }));
};
