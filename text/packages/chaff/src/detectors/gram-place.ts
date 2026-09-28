import type { LengthUnit, Span } from "../plugin.ts";

/** 数えるために詰めた文と、詰めた文の各文字が元の文のどこにあったか。 */
export type Compacted = { readonly text: string; readonly offsets: readonly number[] };

/**
 * n-gram を数えるときと同じ詰め方。word 単位は空白の並びを 1 つにして前後を削り、char 単位は空白を全部除く。
 * 語句が元の文のどこにあるかを戻せるよう、残した文字ごとに元の位置を持つ。
 */
export const compacted = (text: string, unit: LengthUnit): Compacted => {
  const chars: string[] = [];
  const offsets: number[] = [];
  const state = { pendingSpace: -1, at: 0 };
  Array.from(text).forEach((char) => {
    const at = state.at;
    state.at += char.length;
    if (/\s/u.test(char)) {
      if (unit === "word" && chars.length > 0 && state.pendingSpace === -1) state.pendingSpace = at;
      return;
    }
    if (state.pendingSpace !== -1) {
      chars.push(" ");
      offsets.push(state.pendingSpace);
      state.pendingSpace = -1;
    }
    chars.push(char);
    // 位置は UTF-16 の単位で持つ。placeOf は indexOf の位置で引くので、絵文字（2 単位）には 2 つ置く。
    Array.from({ length: char.length }, (_, unit) => offsets.push(at + unit));
  });
  return { text: chars.join(""), offsets };
};

/** 詰めた文の中の gram の最初の出現を、元の文の範囲に戻す。無ければ undefined。 */
export const placeOf = (source: Compacted, gram: string): Span | undefined => {
  const at = source.text.indexOf(gram);
  if (at === -1) return undefined;
  const start = source.offsets[at];
  const last = source.offsets[at + gram.length - 1];
  if (start === undefined || last === undefined) return undefined;
  return { start, end: last + 1 };
};
