import type { DocumentProfile, Span } from "./plugin.ts";

/**
 * 番地は、つなぎの語（各号・及び・本文 …）を挟んで続く。番地とつなぎの並び全体を一つとして探す。
 * 番地の書き方、つなぎの語、並びの後ろに来てよい文字は文書の種類（profiles/*.yaml）が持ち、ここは並べ方だけを知る。
 */
const escape = (word: string): string => word.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

type Compiled = { readonly chain: RegExp; readonly address: RegExp } | undefined;

/** 並びの後ろに来てよい文字（address_end）が無ければ、どこで終わってもよい。 */
const compile = (profile: DocumentProfile): Compiled => {
  if (profile.addresses.length === 0) return undefined;
  const address = `(?:${profile.addresses.join("|")})`;
  const connective = profile.connectives.length === 0 ? "" : `(?:${profile.connectives.map(escape).join("|")})*`;
  const end = profile.addressEnd === undefined ? "" : `(?=${profile.addressEnd})`;
  return { chain: new RegExp(`${address}(?:${connective}${address})*${connective}${end}`, "gu"), address: new RegExp(address, "gu") };
};

const compiled = new WeakMap<DocumentProfile, Compiled>();

const patternsOf = (profile: DocumentProfile): Compiled => {
  if (!compiled.has(profile)) compiled.set(profile, compile(profile));
  return compiled.get(profile);
};

/**
 * 並びとして認めた範囲の中の番地の範囲。「第一条件」「前二項中央銀行」のように後ろが語に続くものは、並びにならないので含まない。
 * 漢字の連なりを数える側も数量を読む側も、同じ範囲を使う。
 */
export const addressSpans = (text: string, profile: DocumentProfile | undefined): Span[] => {
  const patterns = profile === undefined ? undefined : patternsOf(profile);
  if (patterns === undefined) return [];
  return [...text.matchAll(patterns.chain)].flatMap((chain) =>
    [...chain[0].matchAll(patterns.address)].map((address) => ({ start: chain.index + address.index, end: chain.index + address.index + address[0].length })),
  );
};

/** 番地を空白にする。空白が連なりを切るので、番地は数えられず、前後は別の連なりになる。後ろから置き換え、前の位置をずらさない。 */
export const maskAddresses = (text: string, profile: DocumentProfile | undefined): string =>
  addressSpans(text, profile).reduceRight((masked, span) => `${masked.slice(0, span.start)} ${masked.slice(span.end)}`, text);
