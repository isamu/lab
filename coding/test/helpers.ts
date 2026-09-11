import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { FileKind, ProbeContext, ProjectFacts, SourceFile } from "../packages/scoria/src/plugin.ts";
import { ALL_STACKS, ownerOf } from "../packages/scoria/src/stacks/index.ts";

const here = dirname(fileURLToPath(import.meta.url));

export const fixturePath = (...parts: readonly string[]): string => join(here, "fixtures", ...parts);

/**
 * Reads a fixture as a SourceFile without going through classify: fixtures live under test/, so
 * classify would call every one of them "test" and probes that look at source would see nothing.
 * codeLines is still delegated to the owning adapter, because .vue script extraction lives there.
 */
export const loadFixture = async (relative: string, kind: FileKind = "source"): Promise<SourceFile> => {
  const lines = (await readFile(fixturePath(relative), "utf8")).split("\n");
  const codeLinesOf = ownerOf(ALL_STACKS, relative)?.codeLinesOf;
  return { path: relative, kind, lines, codeLines: codeLinesOf === undefined ? lines : codeLinesOf(lines) };
};

export const sourceFile = (path: string, lines: readonly string[], kind: FileKind = "source"): SourceFile => ({
  path,
  kind,
  lines,
  codeLines: lines,
});

const DEFAULT_PROJECT: ProjectFacts = { typescript: true, stacks: ["ts"] };

export const contextOf = (files: readonly SourceFile[], project: ProjectFacts = DEFAULT_PROJECT): ProbeContext => ({
  root: fixturePath(),
  files,
  project,
  exec: () => Promise.resolve({ stdout: "", stderr: "exec is not available in tests", code: 1 }),
});
