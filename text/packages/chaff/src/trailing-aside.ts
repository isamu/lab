/**
 * 文末に添えた括弧（「最優先制約とする（§17）。」の（§17））を除いた、文そのものの終わり。
 * 括弧が注記そのもの（文全体が括弧か、終わった文の後ろで「。）」と閉じる）なら、文末はその中にある。
 * 述語に続く括弧は、中で文が終わっていても添え物（「費用（…を除く。）」）。続けて添えた括弧は全部除く。
 *
 * 後ろから一度だけ読む。法令の文は数千字あり、添えた括弧が何百も続くことがある。
 */
const OPEN = new Set(["(", "（"]);
const CLOSE = new Set([")", "）"]);
const STOPS = new Set(["。", "．", "！", "？", "!", "?"]);
const isSpace = (unit: string): boolean => /\s/u.test(unit);
const isInlineSpace = (unit: string): boolean => unit === " " || unit === "\t" || unit === "　";

/** before より前で、skip に当たらない最後の位置。無ければ -1。 */
const lastBefore = (text: string, before: number, skip: (unit: string) => boolean): number => {
  let index = before - 1;
  while (index >= 0 && skip(text.charAt(index))) index -= 1;
  return index;
};

/** closeAt の閉じ括弧と対になる開き括弧の位置。対が無ければ undefined。 */
const openingOf = (text: string, closeAt: number): number | undefined => {
  let depth = 0;
  for (let index = closeAt - 1; index >= 0; index -= 1) {
    const unit = text.charAt(index);
    if (CLOSE.has(unit)) depth += 1;
    else if (OPEN.has(unit) && depth === 0) return index;
    else if (OPEN.has(unit)) depth -= 1;
  }
  return undefined;
};

/** open から closeAt までの括弧が注記そのもの: 文の頭にあるか、終わった文の後ろで、中の文が終わっている。 */
const isNote = (text: string, open: number, closeAt: number): boolean => {
  if (lastBefore(text, open, isSpace) === -1) return true;
  const previous = text.charAt(lastBefore(text, open, isInlineSpace));
  const inner = lastBefore(text, closeAt, isSpace);
  return (STOPS.has(previous) || previous === "\n") && inner > open && STOPS.has(text.charAt(inner));
};

export const ownEnd = (text: string): number => {
  let limit = text.length;
  for (;;) {
    const closeAt = lastBefore(text, limit, (unit) => isSpace(unit) || STOPS.has(unit));
    const open = CLOSE.has(text.charAt(closeAt)) ? openingOf(text, closeAt) : undefined;
    if (open === undefined) return limit;
    limit = isNote(text, open, closeAt) ? closeAt : open;
  }
};
