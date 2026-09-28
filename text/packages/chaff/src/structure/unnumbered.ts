import type { DocumentProfile, NumberedLine } from "../plugin.ts";

/** 開いている単位と、その行の番号の後ろが本文だったか（見出しでなく）。見出しは前の行から付くことがあるので、行そのものを覚えておく。 */
export type OpenUnit = { readonly numbered: NumberedLine; readonly bodyOnLine: boolean };

type Rule = NonNullable<DocumentProfile["unnumbered"]>;

const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

const compiled = new Map<string, RegExp>();

const patternOf = (indent: string): RegExp => {
  const found = compiled.get(indent) ?? new RegExp(`^${escape(indent)}(?<rest>\\S.*)$`, "u");
  compiled.set(indent, found);
  return found;
};

/**
 * 番号を書かない単位（古い法令は第 2 項以降に番号を振らず、字下げした行を新しい項にする）。
 * inside の種類の単位の行に本文が続くときだけ、その中で開いている depth の単位の次（無ければ 2 番目）として読む。
 * 番号を書いた単位（「２」）がすでにあれば、字下げは番号の代わりではない。
 */
export const unnumberedUnit = (line: string, open: readonly OpenUnit[], rule: Rule | undefined): NumberedLine | undefined => {
  if (rule === undefined) return undefined;
  const rest = patternOf(rule.indent).exec(line)?.groups?.["rest"];
  if (rest === undefined) return undefined;
  const holder = [...open].reverse().find((unit) => unit.numbered.kind === rule.inside);
  if (holder === undefined || !holder.bodyOnLine) return undefined;
  const previous = [...open].reverse().find((unit) => unit.numbered.depth === rule.depth)?.numbered;
  if (previous !== undefined && previous.label !== "") return undefined;
  const number = String((previous === undefined ? 1 : Number(previous.number)) + 1);
  return { kind: "item", depth: rule.depth, number, absolute: false, label: "", heading: "", rest: rest.trim(), ordinal: Number(number) };
};
