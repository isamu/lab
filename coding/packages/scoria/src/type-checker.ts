/**
 * Which of the project's own checkers can read its sources.
 *
 * tsc cannot open a `.vue` file, so in a Vue project it reports every component import as a missing
 * module — errors about the measurement, not the code. vue-tsc is what such a project type-checks
 * with, and it speaks tsc's command line and output.
 */

export type TypeChecker =
  { readonly kind: "found"; readonly tool: "typescript" | "vue-tsc"; readonly bin: string } | { readonly kind: "missing"; readonly reason: string };

/** `(package, bin) => path`, resolved from the target repository. */
export type BinResolver = (packageName: string, binName: string) => string | undefined;

const VUE_STACK = "vue";

export const chooseTypeChecker = (stacks: readonly string[], resolveBin: BinResolver): TypeChecker => {
  if (stacks.includes(VUE_STACK)) {
    const bin = resolveBin("vue-tsc", "vue-tsc");
    return bin === undefined
      ? { kind: "missing", reason: "a Vue project needs vue-tsc installed; tsc alone cannot read .vue files" }
      : { kind: "found", tool: "vue-tsc", bin };
  }
  const bin = resolveBin("typescript", "tsc");
  return bin === undefined ? { kind: "missing", reason: "the project has no installed typescript" } : { kind: "found", tool: "typescript", bin };
};
