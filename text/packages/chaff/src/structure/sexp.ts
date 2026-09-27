import type { StructureNode } from "../plugin.ts";

/** 文字列は二重引用符で囲み、中の \ と " だけを逃がす。改行は \n にして 1 行に保つ。 */
const quote = (text: string): string => `"${text.replace(/\\/gu, "\\\\").replace(/"/gu, '\\"').replace(/\r?\n/gu, "\\n")}"`;

const atom = (value: string | number): string => (typeof value === "number" ? String(value) : quote(value));

/** 属性はキーの順に並べる。同じ木から毎回同じ文字列を出すため。 */
const keywords = (node: StructureNode): string[] => [
  ...Object.keys(node.attrs)
    .sort((left, right) => left.localeCompare(right, "en"))
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
export const toSexp = (node: StructureNode, indent = ""): string => {
  const head = [node.kind, ...(node.address === "" ? [] : [quote(node.address)]), ...keywords(node)].join(" ");
  if (node.children.length === 0) return `${indent}(${head})`;
  const inner = node.children.map((child) => toSexp(child, `${indent}  `)).join("\n");
  return `${indent}(${head}\n${inner})`;
};
