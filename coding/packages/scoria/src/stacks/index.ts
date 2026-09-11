import type { FileKind, StackAdapter } from "../plugin.ts";
export { stackTs } from "./ts.ts";
import { stackTs } from "./ts.ts";
import { stackVue } from "./vue.ts";
import { stackReact } from "./react.ts";

export const ALL_STACKS: readonly StackAdapter[] = [stackVue, stackReact, stackTs];

/** Picks the stacks that apply to a repository from its package.json. ts is always included. */
export const detectStacks = async (root: string): Promise<readonly string[]> => {
  const matched = await Promise.all(ALL_STACKS.map(async (stack) => ({ id: stack.id, detection: await stack.detect(root) })));
  return matched.filter((entry) => entry.detection.matched).map((entry) => entry.id);
};

/** Tries adapters in order and takes the first that returns anything but "ignored". */
export const composeClassify =
  (stacks: readonly StackAdapter[]) =>
  (relativePath: string): FileKind =>
    stacks.map((stack) => stack.classify(relativePath)).find((kind) => kind !== "ignored") ?? "ignored";

/** The adapter that owns a path. codeLinesOf only applies to files that adapter owns, so ownership is settled first. */
export const ownerOf = (stacks: readonly StackAdapter[], relativePath: string): StackAdapter | undefined =>
  stacks.find((stack) => stack.classify(relativePath) !== "ignored");
