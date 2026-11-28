import type { DocumentNamer, Span } from "../plugin.ts";

/**
 * 文の中に書いた文書の名前（「高齢者、障害者等の移動等の円滑化の促進に関する法律」）の位置。
 * 題名は書き手が言い換えられないので、鉤括弧で引いた題名と同じく、中の助詞を数えず一つの名詞として読む。
 * 名前は言語パッケージが読む（名前の終わりの位置を渡すと、そこで終わる名前を返す）。読めない言語では何も返さない。
 */
export const documentNameSpans = (text: string, within: Span, namer: DocumentNamer | undefined): Span[] => {
  if (namer === undefined) return [];
  const ends = Array.from({ length: within.end - within.start }, (_, index) => within.start + index + 1);
  return ends.flatMap((end) => {
    const named = namer(text, end);
    // 名前の後ろの括弧書きやつなぎの語（「民法の」の「の」）を読み飛ばした名前は、ここで終わる名前ではない。
    const endsHere = named !== undefined && named.name !== "" && text.slice(end - named.name.length, end) === named.name;
    return endsHere ? [{ start: end - named.name.length, end }] : [];
  });
};
