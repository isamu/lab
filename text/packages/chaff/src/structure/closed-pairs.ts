/**
 * 閉じた括弧の組を、中身ごと外す。入れ子は内側から外れる。閉じない開きと、開かない閉じは残す。
 * open と close は 1 字ずつ。同じ字なら、前から順に組になる。「内側の組を外す」を繰り返すと、深さの数だけ本文を読み直すので、1 度だけ読む。
 */
export const withoutClosedPairs = (text: string, open: string, close: string): string => {
  const kept: string[] = [];
  const opens: number[] = [];
  for (const char of text) {
    const opened = char === close ? opens.pop() : undefined;
    if (opened !== undefined) kept.splice(opened);
    else {
      if (char === open) opens.push(kept.length);
      kept.push(char);
    }
  }
  return kept.join("");
};

/** 1 字（サロゲートの対も 1 字）か。 */
export const isOneCharacter = (text: string): boolean => [...text].length === 1;
