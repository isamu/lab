import type { StructureNode, Token } from "../plugin.ts";
import { preOrder } from "../tree-walk.ts";

/** 他の文書を指す参照（民法第709条の第709条）の始まりの位置から、その文書の名前（民法）へ。 */
export type CitedNames = ReadonlyMap<number, string>;

const namedReferences = (root: StructureNode): (readonly [number, string])[] =>
  preOrder(root).flatMap((node) => {
    const document = node.attrs["document"];
    return node.kind === "reference" && typeof document === "string" ? [[node.span.start, document] as const] : [];
  });

export const citedNamesOf = (structure: StructureNode | undefined): CitedNames => new Map(structure === undefined ? [] : namedReferences(structure));

/** 略した名前は、頭の一字と種類の一字（所法・法法・措令）。二字の種類の語の重なり（規則規則）は略さない書き方。 */
const ABBREVIATED_KIND_LENGTH = 1;

/**
 * 重なった二語が、番地のすぐ前に書いた文書の名前の全部で、頭の一字と種類の一字か。通達の「法法第64条」は法人税法の略で、
 * 略した頭（法）と種類の語（法）がたまたま同じ字になる。名前の一部だけの重なり（就業規則規則第3条）や、種類の語でない語の
 * 重なり（民法民法第709条）は書き損じのまま。
 */
export const endsCitedName = (first: Token, second: Token, cited: CitedNames, kinds: ReadonlySet<string>): boolean =>
  kinds.has(second.surface) && [...second.surface].length === ABBREVIATED_KIND_LENGTH && cited.get(second.span.end) === `${first.surface}${second.surface}`;
