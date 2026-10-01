import type { Span } from "./plugin.ts";

/**
 * `https://…` をそのまま書いた URL。GFM の autolink 拡張を入れていないので mdast では
 * ただのテキストになる。閉じ括弧や引用符は URL の外の字として止める。
 */
export const BARE_URL = /https?:\/\/[^\s)<>"'\]]+/gu;

/** 文の終わりの句読点。URL の最後の字としてはまず書かれず、URL の後ろの文の字。 */
const PUNCTUATION: ReadonlySet<string> = new Set([".", ",", ";", ":", "!", "?", "。", "、", "，", "．"]);

/** 後ろの句読点を外した長さ。正規表現の `[…]+$` は、句読点の長い並びで後戻りが二乗になる。 */
const lengthWithoutPunctuation = (url: string): number => {
  let end = url.length;
  while (end > 0 && PUNCTUATION.has(url.charAt(end - 1))) end -= 1;
  return end;
};

export type BareUrl = Span & { readonly url: string };

/** text の中の、そのまま書いた URL。文末の句読点は外す。位置は text の先頭を 0 とする。 */
export const bareUrls = (text: string): BareUrl[] =>
  [...text.matchAll(BARE_URL)].map((match) => {
    const url = match[0].slice(0, lengthWithoutPunctuation(match[0]));
    return { start: match.index, end: match.index + url.length, url };
  });
