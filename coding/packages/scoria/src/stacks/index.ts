import type { FileKind, StackAdapter } from "../plugin.ts";
import { stackTs } from "./ts.ts";
import { stackVue } from "./vue.ts";
import { stackReact } from "./react.ts";

export const ALL_STACKS: readonly StackAdapter[] = [stackVue, stackReact, stackTs];

export const stackById = (id: string): StackAdapter | undefined => ALL_STACKS.find((stack) => stack.id === id);

/** package.json から、その repo に当てはまる stack を選ぶ。ts は常に含める。 */
export const detectStacks = async (root: string): Promise<readonly string[]> => {
  const matched = await Promise.all(ALL_STACKS.map(async (stack) => ({ id: stack.id, detection: await stack.detect(root) })));
  return matched.filter((entry) => entry.detection.matched).map((entry) => entry.id);
};

/** adapter を順に試し、最初に ignored 以外を返したものを採る。 */
export const composeClassify =
  (stacks: readonly StackAdapter[]) =>
  (relativePath: string): FileKind =>
    stacks.map((stack) => stack.classify(relativePath)).find((kind) => kind !== "ignored") ?? "ignored";

/** そのパスを扱う adapter。codeLinesOf を持つのは自分が扱うファイルだけなので、先に決める必要がある。 */
export const ownerOf = (stacks: readonly StackAdapter[], relativePath: string): StackAdapter | undefined =>
  stacks.find((stack) => stack.classify(relativePath) !== "ignored");

export { stackTs, stackVue, stackReact };
