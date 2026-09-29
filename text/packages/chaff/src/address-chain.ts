import type { DocumentProfile, Span } from "./plugin.ts";

/**
 * 番地は、つなぎの語（各号・及び・本文 …）を挟んで続く。番地とつなぎの並び全体を一つとして探す。
 * 番地の書き方、つなぎの語、並びの後ろに来てよい文字は文書の種類（profiles/*.yaml）が持ち、ここは並べ方だけを知る。
 *
 * 番地は、その位置で正規表現が当たるとおりに一度だけ取り、後ろに合わせて縮めない。縮めると「第五十二条の二中央銀行」の
 * 「第五十二条」が番地になってしまう。並びは、番地かつなぎの語で終わる切れ目のうち、後ろの決まりを満たす最も長いところまで。
 */
const escape = (word: string): string => word.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

type Compiled = { readonly find: RegExp; readonly address: RegExp; readonly connective: RegExp | undefined; readonly end: RegExp | undefined };

const compile = (profile: DocumentProfile): Compiled | undefined => {
  if (profile.addresses.length === 0) return undefined;
  const address = `(?:${profile.addresses.join("|")})`;
  return {
    find: new RegExp(address, "gu"),
    address: new RegExp(address, "uy"),
    connective: profile.connectives.length === 0 ? undefined : new RegExp(`(?:${profile.connectives.map(escape).join("|")})`, "uy"),
    end: profile.addressEnd === undefined ? undefined : new RegExp(`(?=${profile.addressEnd})`, "uy"),
  };
};

const compiled = new WeakMap<DocumentProfile, Compiled | undefined>();

const patternsOf = (profile: DocumentProfile): Compiled | undefined => {
  if (!compiled.has(profile)) compiled.set(profile, compile(profile));
  return compiled.get(profile);
};

/** at から pattern が当たれば、その終わり。空の一致は当たらなかったことにする。 */
const matchEnd = (pattern: RegExp | undefined, text: string, at: number): number | undefined => {
  if (pattern === undefined) return undefined;
  pattern.lastIndex = at;
  const found = pattern.exec(text);
  return found === null || found[0] === "" ? undefined : at + found[0].length;
};

const endsHere = (patterns: Compiled, text: string, at: number): boolean => {
  if (patterns.end === undefined) return true;
  patterns.end.lastIndex = at;
  return patterns.end.test(text);
};

type Cut = { readonly end: number; readonly addresses: number };

/** at から続くつなぎの語を読み、その切れ目を cuts に足す。読み終えた位置を返す。 */
const readConnectives = (patterns: Compiled, text: string, at: number, addresses: number, cuts: Cut[]): number => {
  let position = at;
  for (let next = matchEnd(patterns.connective, text, position); next !== undefined; next = matchEnd(patterns.connective, text, position)) {
    position = next;
    cuts.push({ end: position, addresses });
  }
  return position;
};

/**
 * 番地の後ろから並びを読み、切れ目（番地かつなぎの語の終わり）と、そこまでの番地を集める。
 * 並びは設定しだいでいくらでも長くなるので、再帰せずに読む。
 */
const readChain = (patterns: Compiled, text: string, first: Span): { spans: Span[]; cuts: Cut[] } => {
  const spans: Span[] = [first];
  const cuts: Cut[] = [{ end: first.end, addresses: 1 }];
  let at = first.end;
  for (;;) {
    const next = readConnectives(patterns, text, at, spans.length, cuts);
    const addressEnd = matchEnd(patterns.address, text, next);
    if (addressEnd === undefined) return { spans, cuts };
    spans.push({ start: next, end: addressEnd });
    cuts.push({ end: addressEnd, addresses: spans.length });
    at = addressEnd;
  }
};

/** start から始まる並び。後ろの決まりを満たす切れ目が無ければ、並びではない。 */
const chainAt = (patterns: Compiled, text: string, start: number): { readonly spans: readonly Span[]; readonly end: number } | undefined => {
  const firstEnd = matchEnd(patterns.address, text, start);
  if (firstEnd === undefined) return undefined;
  const { spans, cuts } = readChain(patterns, text, { start, end: firstEnd });
  const cut = cuts.findLast((candidate) => endsHere(patterns, text, candidate.end));
  return cut === undefined ? undefined : { spans: spans.slice(0, cut.addresses), end: cut.end };
};

/** 1 文字先。絵文字のような 2 単位の文字の途中に止まると、同じ位置の空の一致を繰り返す。 */
const nextCharacter = (text: string, at: number): number => at + ((text.codePointAt(at) ?? 0) > 0xffff ? 2 : 1);

/**
 * 並びとして認めた範囲の中の番地の範囲。「第一条件」「前二項中央銀行」のように後ろが語に続くものは、並びにならないので含まない。
 * 漢字の連なりを数える側も数量を読む側も、同じ範囲を使う。
 */
export const addressSpans = (text: string, profile: DocumentProfile | undefined): Span[] => {
  const patterns = profile === undefined ? undefined : patternsOf(profile);
  if (patterns === undefined) return [];
  const spans: Span[] = [];
  patterns.find.lastIndex = 0;
  for (let found = patterns.find.exec(text); found !== null; found = patterns.find.exec(text)) {
    const chain = chainAt(patterns, text, found.index);
    spans.push(...(chain?.spans ?? []));
    patterns.find.lastIndex = chain === undefined ? nextCharacter(text, found.index) : chain.end;
  }
  return spans;
};

/**
 * 番地を同じ長さの空白にする。空白が連なりを切るので、番地は数えられず、前後は別の連なりになる。
 * 長さを保つので、覆った後の位置は元の文字列の位置のまま。
 */
export const maskAddresses = (text: string, profile: DocumentProfile | undefined): string => {
  const spans = addressSpans(text, profile);
  if (spans.length === 0) return text;
  const pieces: string[] = [];
  spans.forEach((span, index) => pieces.push(text.slice(spans[index - 1]?.end ?? 0, span.start), " ".repeat(span.end - span.start)));
  pieces.push(text.slice(spans.at(-1)?.end ?? 0));
  return pieces.join("");
};
