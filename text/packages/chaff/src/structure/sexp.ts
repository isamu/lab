import type { StructureNode } from "../plugin.ts";

/** 文字列は二重引用符で囲み、中の \ と " だけを逃がす。改行は \n にして 1 行に保つ。 */
const quote = (text: string): string => `"${text.replace(/\\/gu, "\\\\").replace(/"/gu, '\\"').replace(/\r?\n/gu, "\\n")}"`;

const atom = (value: string | number): string => (typeof value === "number" ? String(value) : quote(value));

/** 属性はキーの順に並べる。同じ木から毎回同じ文字列を出すため。 */
const keywords = (node: StructureNode): string[] => [
  ...Object.keys(node.attrs)
    .toSorted((left, right) => left.localeCompare(right, "en"))
    .flatMap((key) => {
      const value = node.attrs[key];
      return value === undefined ? [] : [`:${key} ${atom(value)}`];
    }),
  `:line ${String(node.line)}`,
];

/**
 * 木を S 式にする。人と AI が読むための形で、JSON と同じ木から作る。
 * `(kind "番地" :key value ... 子)`。番地を持たない葉は番地を書かない。
 */
export const toSexp = (root: StructureNode, indent = ""): string => {
  const lines: string[] = [];
  // 1 行に 1 節点。節点を閉じる ")" は、その部分木の最後の行の後ろに付く。
  const pending = [{ node: root, depth: 0, closing: false }];
  while (pending.length > 0) {
    const next = pending.pop();
    if (next === undefined) break;
    if (next.closing) {
      lines.push(`${lines.pop() ?? ""})`);
      continue;
    }
    const head = [next.node.kind, ...(next.node.address === "" ? [] : [quote(next.node.address)]), ...keywords(next.node)].join(" ");
    lines.push(`${indent}${"  ".repeat(next.depth)}(${head}`);
    pending.push({ ...next, closing: true });
    next.node.children.toReversed().forEach((child) => pending.push({ node: child, depth: next.depth + 1, closing: false }));
  }
  return lines.join("\n");
};
