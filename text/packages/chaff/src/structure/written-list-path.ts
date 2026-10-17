// 箇条書きで書いた小見出し。「- (b) Composition: …」の下に字下げして「- i. one representative …」と書いた文書は、
// 「Section 8(b)(i)」の (b) と i を本文の括弧ではなく行の頭の札で書く。札の入れ子は字下げで読む。

/** 行の頭の札。indent は札の前の字下げの幅（タブは 4）。 */
export type ListLabel = { readonly label: string; readonly indent: number };

/** 字下げ、箇条書きの記号（-、*、+）、札、空白、本文。 */
const LIST_LINE = /^(?<indent>[ \t]*)(?:[-*+][ \t]+)?(?<mark>\S+)[ \t]+\S/u;
/** 札「(b)」「i.」「2)」。 */
const MARK = /^\(?(?<label>[a-zA-Z]{1,4}|\d{1,3})[.)]$/u;

/** 札の中身。開き括弧で始まる札は閉じ括弧で終わる（「(b.」は札ではない）。 */
const labelOf = (mark: string): string | undefined => {
  const label = MARK.exec(mark)?.groups?.["label"];
  return mark.startsWith("(") && !mark.endsWith(")") ? undefined : label;
};
const TAB_WIDTH = 4;

const widthOf = (indent: string): number => [...indent].reduce((width, char) => width + (char === "\t" ? TAB_WIDTH : 1), 0);

/** 本文の行の頭に書かれた札を、文書の順に。Pure. */
export const listLabels = (body: string): ListLabel[] =>
  body.split("\n").flatMap((line) => {
    const groups = LIST_LINE.exec(line)?.groups;
    const label = labelOf(groups?.["mark"] ?? "");
    return label === undefined ? [] : [{ label, indent: widthOf(groups?.["indent"] ?? "") }];
  });

/** 札 index の下（次に同じか浅い字下げの札が来るまで）の終わり。 */
const scopeEnd = (items: readonly ListLabel[], index: number, end: number): number => {
  const depth = items[index]?.indent ?? 0;
  const next = items.findIndex((item, at) => at > index && at < end && item.indent <= depth);
  return next === -1 ? end : next;
};

/** items[from, end) の一番浅い字下げの札（直下の札）から、labels を入れ子の順にたどれるか。深い札を飛ばして親にしない。 */
const pathFrom = (items: readonly ListLabel[], labels: readonly string[], from: number, end: number): boolean => {
  const [first, ...rest] = labels;
  if (first === undefined) return true;
  const scope = items.slice(from, end);
  const top = Math.min(...scope.map((item) => item.indent));
  return scope.some((item, at) => item.indent === top && item.label === first && pathFrom(items, rest, from + at + 1, scopeEnd(items, from + at, end)));
};

/** 札「b」「iv」が、行の頭の札として「(b)」の下に「iv.」と入れ子で書かれているか。札が無ければ false。Pure. */
export const hasListPath = (items: readonly ListLabel[], labels: readonly string[]): boolean => labels.length > 0 && pathFrom(items, labels, 0, items.length);
