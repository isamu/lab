import type { DocumentProfile } from "./plugin.ts";

/**
 * 番地は、つなぎの語（各号・及び・本文 …）を挟んで続く。番地とつなぎの並び全体を一つとして探す。
 * 番地の書き方とつなぎの語は文書の種類（profiles/*.yaml）が持ち、ここは並べ方だけを知る。
 */
const escape = (word: string): string => word.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

const chainSource = (profile: DocumentProfile): string | undefined => {
  if (profile.addresses.length === 0) return undefined;
  const address = `(?:${profile.addresses.join("|")})`;
  const connective = profile.connectives.length === 0 ? "" : `(?:${profile.connectives.map(escape).join("|")})*`;
  return `${address}(?:${connective}${address})*${connective}`;
};

type Compiled = { readonly chain: RegExp; readonly address: RegExp } | undefined;

const compiled = new WeakMap<DocumentProfile, Compiled>();

/** end は並びのすぐ後ろに求める形（「漢字でない文字か行末」）。これで「第一条件」の「第一条」を番地にしない。 */
const compile = (profile: DocumentProfile, end: string): Compiled => {
  const source = chainSource(profile);
  return source === undefined ? undefined : { chain: new RegExp(`${source}(?=${end})`, "gu"), address: new RegExp(`(?:${profile.addresses.join("|")})`, "gu") };
};

/** 漢字の連なりを数える側の終わり方。並びの後ろに漢字が続けば、番地ではなく普通の語。 */
const ENDS_BEFORE_KANJI = "[^\\p{Script=Han}]|$";

/** 番地の並びの中の番地を空白にする。空白が連なりを切るので、番地は数えられず、前後は別の連なりになる。 */
export const maskAddresses = (text: string, profile: DocumentProfile | undefined): string => {
  if (profile === undefined) return text;
  if (!compiled.has(profile)) compiled.set(profile, compile(profile, ENDS_BEFORE_KANJI));
  const patterns = compiled.get(profile);
  return patterns === undefined ? text : text.replace(patterns.chain, (chain) => chain.replace(patterns.address, " "));
};
