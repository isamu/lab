/**
 * 丸括弧の閉じを、開きを持たない印として読むかどうか。印に使うのは丸括弧だけなので、呼ぶ側が丸括弧の閉じに限る。
 * text は節の文字列で、offset は閉じの位置。
 */
import { escapeRegExp } from "../orthography.ts";

/** 行の頭か空白・句読点の後ろに書いた、三文字までの印（「1)」「a)」「事例）」「※）」）。顔文字の「:)」も同じ形。 */
const LABEL_TOKEN_BEFORE = /(?:^|[\s、。,;:：])[^\s()（）[\]［］「」『』]{1,3}[ \t\u3000]?$/u;

/** 数の後ろの閉じ（「事例2）及び事例3）」）。 */
const NUMBER_BEFORE = /[\d０-９]$/u;

/** 句読点の後ろの、字の後ろに数を付けた印（「以下、事例5）」）。group 1 は数の前の字（「事例」）。 */
const NUMBERED_LABEL_BEFORE = /[、。,;:：] ?([^\s\d０-９()（）[\]［］「」『』、。,;:：]{1,3})[\d０-９]{1,3}$/u;

const ROUND_OPEN = new Set(["（", "("]);
const ROUND_CLOSE = new Set(["）", ")"]);

const lineBefore = (text: string, offset: number): string => text.slice(text.lastIndexOf("\n", offset - 1) + 1, offset);

const isLabelToken = (text: string, offset: number): boolean => LABEL_TOKEN_BEFORE.test(lineBefore(text, offset));

/** 開いている丸括弧が無いときの閉じが、印の形をしているか。 */
export const isLabelClose = (text: string, offset: number): boolean => isLabelToken(text, offset) || NUMBER_BEFORE.test(lineBefore(text, offset));

const restOfLine = (text: string, offset: number): string => {
  const end = text.indexOf("\n", offset);
  return text.slice(offset + 1, end === -1 ? text.length : end);
};

/** offset の後ろ、同じ行のうちの、印の形でない閉じのうち、それより前に開いた丸括弧を閉じるものの数。間の丸括弧の組は数えない。 */
const outerClosesLaterOnLine = (text: string, offset: number): number => {
  const depth = { inner: 0, outer: 0 };
  restOfLine(text, offset)
    .split("")
    .forEach((mark, index) => {
      if (ROUND_OPEN.has(mark)) depth.inner += 1;
      if (!ROUND_CLOSE.has(mark)) return;
      if (depth.inner > 0) depth.inner -= 1;
      else if (!isLabelClose(text, offset + 1 + index)) depth.outer += 1;
    });
  return depth.outer;
};

/** 節のどこかの行の頭（箇条の印の後ろも含む）に、同じ字で始まる番号の印（「- 事例1）」）を書いているか。 */
const usedAsLineLabel = (text: string, stem: string): boolean =>
  new RegExp(`^[ \\t\u3000]*(?:[-*+・][ \\t\u3000]*)?${escapeRegExp(stem)}[\\d０-９]{1,3}[)）]`, "mu").test(text);

/**
 * 開いた丸括弧の中の印（「（…以下、事例5）まで同じ。）」の「事例5）」）。三つがそろうときだけ印と読む: 句読点の後ろの、字に数を
 * 付けた形であること。同じ字の番号の印を、節のどこかの行の頭で使っていること。同じ行の後ろの閉じだけで、いま開いている
 * 丸括弧（openRound 個）をすべて閉じられること。どれかが欠ければ、この閉じで括弧を閉じる（「（項目 1）を確認した）」は
 * 余分な閉じを指す）。
 */
export const isLabelInAside = (text: string, offset: number, openRound: number): boolean => {
  const stem = NUMBERED_LABEL_BEFORE.exec(lineBefore(text, offset))?.[1];
  return stem !== undefined && usedAsLineLabel(text, stem) && outerClosesLaterOnLine(text, offset) >= openRound;
};
