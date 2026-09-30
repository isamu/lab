import type { RelativeVocabulary } from "../plugin.ts";

type Aside = RelativeVocabulary["aside"];

/** 文字と、その位置（UTF-16 の単位で）。絵文字のような 2 単位の文字も 1 文字として読む。 */
export const characters = (text: string): { readonly char: string; readonly at: number }[] => {
  const found: { char: string; at: number }[] = [];
  let at = 0;
  for (const char of text) {
    found.push({ char, at });
    at += char.length;
  }
  return found;
};

/** at の位置で開いたままの括弧書きの開きの位置。text の頭から at まで読む。 */
export const openAsidesAt = (text: string, at: number, aside: Aside): number[] => {
  const opens: number[] = [];
  if (aside === undefined) return opens;
  characters(text.slice(0, at)).forEach(({ char, at: position }) => {
    if (char === aside.open) opens.push(position);
    if (char === aside.close) opens.pop();
  });
  return opens;
};

/** at で開いたままの括弧書きの数（depth）と、一番内側の開きの位置（innermost）。 */
export type AsideDepth = { readonly depth: (at: number) => number; readonly innermost: (at: number) => number | undefined };

/** 文字の切れ目でない位置（2 単位の文字の途中）の印。 */
const UNREAD = -2;
const NO_OPEN = -1;

/**
 * 本文を一度だけ読み、文字の切れ目ごとに openAsidesAt の答えを覚える。参照ごとに頭から読み直すと、参照の数と行の長さの積になる。
 * 覚えていない位置（文字の途中、本文の外）は openAsidesAt で読む。
 */
export const asideDepth = (text: string, aside: Aside): AsideDepth => {
  if (aside === undefined) return { depth: () => 0, innermost: () => undefined };
  const depths = new Int32Array(text.length + 1).fill(UNREAD);
  const innermosts = new Int32Array(text.length + 1).fill(UNREAD);
  const opens: number[] = [];
  depths[0] = 0;
  innermosts[0] = NO_OPEN;
  characters(text).forEach(({ char, at }) => {
    if (char === aside.open) opens.push(at);
    if (char === aside.close) opens.pop();
    depths[at + char.length] = opens.length;
    innermosts[at + char.length] = opens.at(-1) ?? NO_OPEN;
  });
  const read = (at: number): boolean => Number.isInteger(at) && at >= 0 && at <= text.length && depths[at] !== UNREAD;
  return {
    depth: (at) => (read(at) ? (depths[at] ?? 0) : openAsidesAt(text, at, aside).length),
    innermost: (at) => {
      if (!read(at)) return openAsidesAt(text, at, aside).at(-1);
      const open = innermosts[at] ?? NO_OPEN;
      return open === NO_OPEN ? undefined : open;
    },
  };
};
