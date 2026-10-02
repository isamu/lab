/** 名前や値の端の、強調の印と空白。全角の空白も入れる。 */
export const EDGE_MARKS: ReadonlySet<string> = new Set(["*", "_", " ", "\t", "　"]);

/** 後ろの端から、chars の字を落とす。正規表現の [..]*$ は長い行で後戻りが重くなるので、端から数える。 */
export const trimEndOf = (text: string, chars: ReadonlySet<string>): string => {
  let end = text.length;
  while (end > 0 && chars.has(text.charAt(end - 1))) end -= 1;
  return text.slice(0, end);
};

const trimStartOf = (text: string, chars: ReadonlySet<string>): string => {
  let start = 0;
  while (start < text.length && chars.has(text.charAt(start))) start += 1;
  return text.slice(start);
};

/** 両端から、強調の印と空白を落とす。 */
export const withoutEdgeMarks = (text: string): string => trimStartOf(trimEndOf(text, EDGE_MARKS), EDGE_MARKS);
