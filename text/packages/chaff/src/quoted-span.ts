import type { Span } from "./plugin.ts";

/** 鉤括弧の開きと、それを閉じる字。 */
const CLOSER: Readonly<Record<string, string>> = { "「": "」", "『": "』" };

type Open = { readonly closer: string; readonly at: number };
type Scan = { readonly open: readonly Open[]; readonly spans: readonly Span[] };

const step = (scan: Scan, char: string, at: number): Scan => {
  const closer = CLOSER[char];
  if (closer !== undefined) return { open: [...scan.open, { closer, at }], spans: scan.spans };
  const last = scan.open.at(-1);
  if (last === undefined || last.closer !== char) return scan;
  return { open: scan.open.slice(0, -1), spans: [...scan.spans, { start: last.at + 1, end: at }] };
};

/**
 * 鉤括弧（「」『』）の中身の位置。括弧そのものは含まない。入れ子はそれぞれを返す。
 * 閉じない括弧と、開きと組にならない閉じ括弧は中身を作らない。位置は text の先頭を 0 とする。
 * 括弧は BMP の字なので、UTF-16 の 1 単位ずつ見れば位置がそのまま使える。
 */
export const quotedSpans = (text: string): Span[] => [...text.split("").reduce<Scan>((scan, char, at) => step(scan, char, at), { open: [], spans: [] }).spans];

/** inner が、spans のどれかにまるごと入っているか。 */
export const isWithinAny = (spans: readonly Span[], inner: Span): boolean => spans.some((span) => inner.start >= span.start && inner.end <= span.end);
