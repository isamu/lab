import type { Detector, Finding, Span } from "../plugin.ts";
import { findingAt, quoteOf } from "./markup-finding.ts";

/** そのまま書いた URL の、ASCII の字だけの並び。 */
const BARE_URL = /https?:\/\/[!-~]+/gu;

/**
 * URL は ASCII の字を空白まで取るので、後ろに来るのは空白か ASCII でない字。GFM の自動リンクや多くのメールソフトは空白が来るまでを
 * リンクにするので、空白でない字はリンクに入る。見えない字（ゼロ幅の空白など、Cf）は折り返しのために入れたもので、読み手には続いて見えない。
 */
const RUNS_ON = /[^\s\p{Cf}]/u;

/** index から始まる一字（サロゲートの対は一字）。末尾より後ろは空。 */
const characterAt = (text: string, index: number): string => {
  const point = text.codePointAt(index);
  return point === undefined ? "" : String.fromCodePoint(point);
};

export type RunOnUrl = { readonly url: Span; readonly next: string };

/** 字のまま見える範囲（texts）の中の、すぐ後ろに空白を置かずに日本語や全角の記号が続く URL。 */
export const runOnUrls = (source: string, texts: readonly Span[]): RunOnUrl[] =>
  texts.flatMap((text) => {
    const written = source.slice(text.start, text.end);
    return [...written.matchAll(BARE_URL)].flatMap((match) => {
      const end = match.index + match[0].length;
      const next = characterAt(written, end);
      return RUNS_ON.test(next) ? [{ url: { start: text.start + match.index, end: text.start + end }, next }] : [];
    });
  });

export const urlRunOn: Detector = (doc): Finding[] =>
  runOnUrls(doc.source, doc.markup?.texts ?? []).map(({ url, next }) => findingAt(doc, url, { url: quoteOf(doc.source, url), next }));
