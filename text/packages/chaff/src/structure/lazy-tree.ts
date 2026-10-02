import type { StructureNode, StructurePatterns } from "../plugin.ts";
import { buildTree, type StructureInput } from "./build.ts";

/**
 * 構造の rule（参照先が無い・番号の抜け）が読む木を、読まれたときに一度だけ作る。どの rule も読まなければ作らない。
 * 何万行の契約書で、他の rule の lint に代金を払わせない。構造を読めない言語（patterns が無い）では無い。
 */
export const lazyTree = (patterns: StructurePatterns | undefined, input: () => StructureInput): (() => StructureNode | undefined) => {
  // null は「作ったが構造を読めない言語だった」、undefined は「まだ作っていない」。
  const tree: { value: StructureNode | null | undefined } = { value: undefined };
  return () => {
    tree.value ??= patterns === undefined ? null : buildTree(input(), patterns);
    return tree.value ?? undefined;
  };
};
