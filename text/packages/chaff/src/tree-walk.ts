/**
 * Walks over the Markdown tree and the structure tree. Both keep their own stack instead of recursing:
 * a blockquote nested ten thousand levels deep is valid Markdown, and one call per level overflows the call stack.
 */

type Branching<T> = { readonly children?: readonly T[] | undefined };

/** Each node before its children, children from the left: the order a recursive walk visits them. */
export const eachPreOrder = <T extends Branching<T>>(root: T, visit: (node: T) => void): void => {
  const pending: T[] = [root];
  while (pending.length > 0) {
    const node = pending.pop();
    if (node === undefined) return;
    visit(node);
    (node.children ?? []).toReversed().forEach((child) => pending.push(child));
  }
};

/** The nodes in pre-order. */
export const preOrder = <T extends Branching<T>>(root: T): T[] => {
  const nodes: T[] = [];
  eachPreOrder(root, (node) => nodes.push(node));
  return nodes;
};

type Frame<T, R> = { readonly node: T; readonly children: readonly T[]; readonly results: R[] };

/**
 * Each node's value from its children's values: children first, from the left, then the node. depth is 0 at the root.
 * The same calls in the same order as `combine(node, childrenOf(node).map(recurse), depth)`.
 */
export const foldPostOrder = <T, R>(root: T, childrenOf: (node: T) => readonly T[], combine: (node: T, children: readonly R[], depth: number) => R): R => {
  const frames: Frame<T, R>[] = [{ node: root, children: childrenOf(root), results: [] }];
  for (;;) {
    const frame = frames.at(-1);
    if (frame === undefined) throw new Error("foldPostOrder lost its root");
    const next = frame.children[frame.results.length];
    if (next !== undefined) {
      frames.push({ node: next, children: childrenOf(next), results: [] });
      continue;
    }
    frames.pop();
    const value = combine(frame.node, frame.results, frames.length);
    const parent = frames.at(-1);
    if (parent === undefined) return value;
    parent.results.push(value);
  }
};
