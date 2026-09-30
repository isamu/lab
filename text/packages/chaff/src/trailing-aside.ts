/**
 * 文末に添えた括弧（「最優先制約とする（§17）。」の（§17））を除いた、文そのものの終わり。
 * 括弧が注記そのもの（文全体が括弧か、終わった文の後ろで「。）」と閉じる）なら、文末はその中にある。
 * 述語に続く括弧は、中で文が終わっていても添え物（「費用（…を除く。）」）。続けて添えた括弧は全部除く。
 */
const OPEN = new Set(["(", "（"]);
const CLOSE = new Set([")", "）"]);
const STOP_OR_SPACE = /[\s。．！？!?]/u;
const STOP = /[。．！？!?]\s*$/u;
const AFTER_SENTENCE = /[。．！？!?\n][ \t\u3000]*$/u;

type Scan = { readonly depth: number; readonly open: number | undefined };

/** closeAt の閉じ括弧と対になる開き括弧の位置。対が無ければ undefined。 */
const openingOf = (text: string, closeAt: number): number | undefined =>
  text
    .slice(0, closeAt)
    .split("")
    .reduceRight<Scan>(
      (scan, unit, index) => {
        if (scan.open !== undefined) return scan;
        if (CLOSE.has(unit)) return { depth: scan.depth + 1, open: undefined };
        if (!OPEN.has(unit)) return scan;
        return scan.depth === 0 ? { depth: 0, open: index } : { depth: scan.depth - 1, open: undefined };
      },
      { depth: 0, open: undefined },
    ).open;

const isNote = (text: string, open: number, end: number): boolean => {
  const before = text.slice(0, open);
  return before.trim() === "" || (AFTER_SENTENCE.test(before) && STOP.test(text.slice(open + 1, end - 1)));
};

export const ownEnd = (text: string): number => {
  const end = text.split("").findLastIndex((unit) => !STOP_OR_SPACE.test(unit)) + 1;
  if (!CLOSE.has(text[end - 1] ?? "")) return text.length;
  const open = openingOf(text, end - 1);
  if (open === undefined) return text.length;
  return ownEnd(isNote(text, open, end) ? text.slice(0, end - 1) : text.slice(0, open));
};
