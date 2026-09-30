import type { Sentence, Span } from "./plugin.ts";

/** 開きの字と、それを閉じる字。 */
type Marks = Readonly<Record<string, string>>;

/** 鉤括弧。日本語の引用と題名。 */
export const KAGI_MARKS: Marks = { "「": "」", "『": "』" };

/**
 * 引用符も含めた、人の言葉を引く印。英語の "…" は開きと閉じが同じ字なので、開いている間に来たら閉じと読む。
 * 一重の ’ は "don’t" の省略の印と見分けられないので入れない。
 */
export const QUOTATION_MARKS: Marks = { ...KAGI_MARKS, "“": "”", '"': '"' };

type Open = { readonly closer: string; readonly at: number };
type Scan = { readonly open: readonly Open[]; readonly spans: readonly Span[] };

const step =
  (marks: Marks) =>
  (scan: Scan, char: string, at: number): Scan => {
    const last = scan.open.at(-1);
    if (last !== undefined && last.closer === char) return { open: scan.open.slice(0, -1), spans: [...scan.spans, { start: last.at + 1, end: at }] };
    const closer = marks[char];
    return closer === undefined ? scan : { open: [...scan.open, { closer, at }], spans: scan.spans };
  };

/**
 * 引いたものの中身の位置（既定は鉤括弧「」『』）。括弧そのものは含まない。入れ子はそれぞれを返す。
 * 閉じない括弧と、開きと組にならない閉じ括弧は中身を作らない。位置は text の先頭を 0 とする。
 * 括弧は BMP の字なので、UTF-16 の 1 単位ずつ見れば位置がそのまま使える。
 */
export const quotedSpans = (text: string, marks: Marks = KAGI_MARKS): Span[] => [...text.split("").reduce<Scan>(step(marks), { open: [], spans: [] }).spans];

/** 文の中の、引いたものを括弧ごと、文書全体の座標で。 */
export const quotedIn = (sentence: Sentence, marks: Marks = KAGI_MARKS): Span[] =>
  quotedSpans(sentence.text, marks).map((span) => ({ start: sentence.span.start + span.start - 1, end: sentence.span.start + span.end + 1 }));

/** inner が、spans のどれかにまるごと入っているか。 */
export const isWithinAny = (spans: readonly Span[], inner: Span): boolean => spans.some((span) => inner.start >= span.start && inner.end <= span.end);
