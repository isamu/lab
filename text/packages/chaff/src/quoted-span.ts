import type { Sentence, Span } from "./plugin.ts";

/** 開きの字と、それを閉じる字。 */
type Marks = Readonly<Record<string, string>>;

/** 鉤括弧。日本語の引用と題名。 */
const KAGI_MARKS: Marks = { "「": "」", "『": "』" };

/**
 * 引用符も含めた、人の言葉を引く印。英語の "…" は開きと閉じが同じ字なので、開いている間に来たら閉じと読む。
 * 一重の ’ は "don’t" の省略の印と見分けられないので入れない。
 */
export const QUOTATION_MARKS: Marks = { ...KAGI_MARKS, "“": "”", '"': '"' };

type Open = { readonly closer: string; readonly at: number };
/** 1 回の読みの中だけで足し引きする。字ごとに配列を作り直すと、括弧が何万もある文で二乗に遅くなる。 */
type Scan = { readonly open: Open[]; readonly spans: Span[] };

const step =
  (marks: Marks) =>
  (scan: Scan, char: string, at: number): Scan => {
    const last = scan.open.at(-1);
    if (last !== undefined && last.closer === char) {
      scan.open.pop();
      scan.spans.push({ start: last.at + 1, end: at });
      return scan;
    }
    const closer = marks[char];
    if (closer !== undefined) scan.open.push({ closer, at });
    return scan;
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

const MARKS = /[\s\p{P}]+/u;
const LETTERS = /^\p{L}+$/u;

/** 記号と空白のあいだに残る語が、字だけの語で、多くとも allowed 個か。 */
const holdsAtMost = (text: string, allowed: number): boolean => {
  const words = text.split(MARKS).filter((word) => word !== "");
  return words.length <= allowed && words.every((word) => LETTERS.test(word));
};

/**
 * span だけを引いた引用符（"delves"、"?utm_source=chatgpt.com"、"October 26, 2026 – October 19, 2026"）の中か。
 * 引用符が語だけを囲めば、その語は使ったのではなく例として挙げたもの。周りの記号と空白は語の一部に数えない。
 * wordsBesides は、span のほかに引用符の中にあってよい語の数（日付なら曜日の一語）。
 * 話した言葉の引用（"We ship on Monday, October 26," she said.）は語のほかの字を持つので当たらない。引用は一行の中だけを見る。
 */
export const isQuotedAlone = (text: string, span: Span, wordsBesides = 0): boolean => {
  const lineStart = text.lastIndexOf("\n", span.start - 1) + 1;
  const newline = text.indexOf("\n", span.end);
  const line = text.slice(lineStart, newline === -1 ? text.length : newline);
  const [start, end] = [span.start - lineStart, span.end - lineStart];
  return quotedSpans(line, QUOTATION_MARKS).some(
    (quoted) => quoted.start <= start && end <= quoted.end && holdsAtMost(`${line.slice(quoted.start, start)} ${line.slice(end, quoted.end)}`, wordsBesides),
  );
};

/** inner が、spans のどれかにまるごと入っているか。 */
export const isWithinAny = (spans: readonly Span[], inner: Span): boolean => spans.some((span) => inner.start >= span.start && inner.end <= span.end);
