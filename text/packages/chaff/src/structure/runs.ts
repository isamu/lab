/**
 * 箇条書きと表の行の並び。続いた箇条書きの同じ深さの項目か、続いた表の行を一つの並びとして読む。
 * 並びの中の値（日付、金額）を比べる rule が共通に使う。
 */
type Kind = "list" | "table";

const LIST_ITEM = /^[ \t]{0,12}(?:[-*+]|\d{1,3}[.)])[ \t]/u;
export const TABLE_ROW = /^[ \t]{0,12}\|/u;

export const TABLE_RULE = /^[ \t]{0,12}\|?[ \t]{0,4}:?-{3,}/u;
const INDENT = /^[ \t]*/u;

export type Line = { readonly start: number; readonly end: number; readonly kind: Kind | undefined; readonly indent: number; readonly rule: boolean };

const kindOf = (text: string): Kind | undefined => {
  if (TABLE_ROW.test(text)) return "table";
  return LIST_ITEM.test(text) ? "list" : undefined;
};

/** 先頭に | を書かない表（「Step | Date」「--- | ---」）の行。| のある見出しの下の区切り行から、| のある行が続くあいだ。 */
const PIPELESS_RULE = /^[ \t]{0,12}:?-{3,}:?[ \t]{0,4}\|/u;

const pipelessTableLines = (texts: readonly string[]): Set<number> => {
  const inTable = new Set<number>();
  texts.forEach((text, index) => {
    if (!PIPELESS_RULE.test(text) || !(texts[index - 1] ?? "").includes("|")) return;
    for (let row = index + 1; row < texts.length && (texts[row] ?? "").includes("|"); row += 1) inTable.add(row);
  });
  return inTable;
};

const linesOf = (source: string): Line[] => {
  const texts = source.split("\n");
  const pipeless = pipelessTableLines(texts);
  const found: Line[] = [];
  let start = 0;
  texts.forEach((text, index) => {
    const indent = INDENT.exec(text)?.[0].length ?? 0;
    const kind = pipeless.has(index) ? "table" : kindOf(text);
    found.push({ start, end: start + text.length, kind, indent, rule: TABLE_RULE.test(text) });
    start += text.length + 1;
  });
  return found;
};

/**
 * 続いた箇条書きや表の中で、同じ深さの行を一つの並びにする。
 * 子の項目（深い字下げ）は親の並びを切らずに、親ごとに別の並びになる。浅い項目が来たら、それより深い並びは閉じる。
 * 表の区切り行（|---|）のすぐ前の行は見出しなので、並びから外す。
 */
export const runsOf = (source: string): Line[][] => {
  const runs: Line[][] = [];
  const open = new Map<number, Line[]>();
  const close = (deeperThan: number): void => [...open.keys()].filter((depth) => depth > deeperThan).forEach((depth) => open.delete(depth));
  linesOf(source).forEach((line, index, all) => {
    if (line.kind === undefined || all[index - 1]?.kind !== line.kind) close(-1);
    if (line.kind === undefined) return;
    if (line.rule) {
      open.get(line.indent)?.pop();
      return;
    }
    close(line.indent);
    const run = open.get(line.indent) ?? [];
    if (!open.has(line.indent)) {
      open.set(line.indent, run);
      runs.push(run);
    }
    run.push(line);
  });
  return runs;
};
