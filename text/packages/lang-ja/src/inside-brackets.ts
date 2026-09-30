/**
 * 括弧・二重引用符の中の句点は文を閉じない。sentence-splitter は括弧を種類ごとに一つしか数えないので、
 * 同じ種類が入れ子になると内側の閉じ括弧で外側まで閉じたと読み（「（…（…）…。以下同じ。）に」）、曲がった二重引用符（“…”）は数えない。
 * ここでは開きと閉じを入れ子のまま組にする。一重引用符（‘ ’）はアポストロフィと見分けられず、直線の引用符は分割器が数えるので、どちらも数えない。
 */
const OPENER = /[\p{Ps}“«]/u;
const CLOSER = /[\p{Pe}”»]/u;
const LINE_BREAK = /[\n\r]/u;

type Pair = { readonly open: number; readonly close: number };

/**
 * 同じ行の中で組になった開きと閉じの位置。組にならないもの（「1）」の番号、同上の印の「“」、閉じない括弧）は含めない。
 * 閉じない括弧を数えると、行の終わりまでの文が全部つながる。
 */
const pairsOf = (text: string): Pair[] => {
  const pairs: Pair[] = [];
  const opened: number[] = [];
  text.split("").forEach((unit, index) => {
    if (LINE_BREAK.test(unit)) opened.length = 0;
    else if (OPENER.test(unit)) opened.push(index);
    else if (CLOSER.test(unit)) {
      const open = opened.pop();
      if (open !== undefined) pairs.push({ open, close: index });
    }
  });
  return pairs;
};

/** 閉じ括弧・閉じ引用符で始まるか。前の行で開いた括弧や数え損ねた括弧の閉じが、句点の後で文頭に残ったもの。 */
export const startsWithCloser = (text: string): boolean => CLOSER.test(text.trimStart().charAt(0));

/** 各位置（0 から text.length まで）の手前に、同じ行で後から閉じる括弧・二重引用符が開いているか。 */
export const insideBrackets = (text: string): boolean[] => {
  const change = Array.from({ length: text.length + 2 }, () => 0);
  pairsOf(text).forEach((pair) => {
    change[pair.open + 1] = (change[pair.open + 1] ?? 0) + 1;
    change[pair.close + 1] = (change[pair.close + 1] ?? 0) - 1;
  });
  const depth = { value: 0 };
  return change.slice(0, text.length + 1).map((step) => {
    depth.value += step;
    return depth.value > 0;
  });
};
