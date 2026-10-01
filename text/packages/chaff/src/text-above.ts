/**
 * 箇条書きや表のすぐ上に書いた文の塊。予告の文（以下の3点）や、割合の表の説明（売上の構成比）を読む rule が使う。
 * 文書の頭まで読み返さないので、箇条書きや表の多い長い文書でも行数に比例する。
 */
export type TextBlock = { readonly start: number; readonly text: string };

const BLANK = /^[ \t]*$/u;
const LIST_MARKER = /^[ \t]*(?:[-*+]|\d{1,3}[.)])[ \t]/u;

export const isBlank = (text: string): boolean => BLANK.test(text);

/** 位置 end の改行で終わる行。 */
const lineEndingAt = (source: string, end: number): TextBlock => {
  const start = end === 0 ? 0 : source.lastIndexOf("\n", end - 1) + 1;
  return { start, text: source.slice(start, end) };
};

/** start の行の一つ上の行。文書の最初の行なら undefined。 */
export const lineAbove = (source: string, start: number): TextBlock | undefined => {
  if (start === 0) return undefined;
  const end = source.lastIndexOf("\n", start - 1);
  return end < 0 ? undefined : lineEndingAt(source, end);
};

/**
 * start の行より上の塊を、下の行から上へ。passed に当たる行（表の見出しの行など）と空行は、塊に着くまで飛ばす。
 * 塊は次の空行まで。箇条書きの印で始まる行（親の項目）はそこで止める。下の行から順に返す。
 */
export const linesAbove = (source: string, start: number, passed: (text: string) => boolean = () => false): TextBlock[] => {
  const block: TextBlock[] = [];
  let line = lineAbove(source, start);
  while (line !== undefined) {
    if (isBlank(line.text) || (block.length === 0 && passed(line.text))) {
      if (block.length > 0) break;
    } else {
      block.push(line);
      if (LIST_MARKER.test(line.text)) break;
    }
    line = lineAbove(source, line.start);
  }
  return block;
};

/** 下の行から並べた塊を、一続きの文字列にする。 */
export const joined = (source: string, lines: readonly TextBlock[]): TextBlock | undefined => {
  const top = lines.at(-1);
  const bottom = lines[0];
  return top === undefined || bottom === undefined ? undefined : { start: top.start, text: source.slice(top.start, bottom.start + bottom.text.length) };
};
