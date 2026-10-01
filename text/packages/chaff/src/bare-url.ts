import type { Span } from "./plugin.ts";

/**
 * `https://…` をそのまま書いた URL。GFM の autolink 拡張を入れていないので mdast では
 * ただのテキストになり、本文として残る。残すと、見出しと URL の中の識別子が一致して
 * 「見出しの繰り返し」と読まれる。表示される文字も本文ではない。
 * 空白が来るまでを取るので、URL の直後に続けた日本語（「https://example.jp/をご覧ください」の「をご覧ください」）も入る。
 */
export const BARE_URL = /https?:\/\/[^\s)<>"'\]]+/gu;

/** 文の終わりの句読点。URL の最後の字としてはまず書かれず、URL の後ろの文の字。 */
const PUNCTUATION: ReadonlySet<string> = new Set([".", ",", ";", ":", "!", "?"]);

/**
 * そのまま書いた URL に続けた文の始まり: ひらがなと全角の句読点・括弧（「…/をご覧ください」「…/。」）。
 * 漢字やカタカナは道の名前（/東京、/カタログ）にもなるので切らない。
 */
const SENTENCE_AFTER = /[\p{Script=Hiragana}\u3000-\u303f\uff01-\uff0f\uff1a-\uff20]/u;

/** URL として読む長さ。続けた文の手前で切り、後ろの句読点を外す。正規表現の `[…]+$` は句読点の長い並びで後戻りが二乗になる。 */
const urlLength = (written: string): number => {
  const cut = SENTENCE_AFTER.exec(written)?.index ?? written.length;
  let end = cut;
  while (end > 0 && PUNCTUATION.has(written.charAt(end - 1))) end -= 1;
  return end;
};

export type BareUrl = Span & { readonly url: string };

/** text の中の、そのまま書いた URL。続けて書いた日本語と文末の句読点は外す。位置は text の先頭を 0 とする。 */
export const bareUrls = (text: string): BareUrl[] =>
  [...text.matchAll(BARE_URL)].map((match) => {
    const url = match[0].slice(0, urlLength(match[0]));
    return { start: match.index, end: match.index + url.length, url };
  });
