import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { ConfigFile, FileKind, ProbeContext, ProjectFacts, SourceFile } from "../packages/scoria/src/plugin.ts";
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

const DEFAULT_PROJECT: ProjectFacts = { typescript: true, installed: true, stacks: ["ts"] };

export const contextOf = (files: readonly SourceFile[], project: ProjectFacts = DEFAULT_PROJECT, configFiles: readonly ConfigFile[] = []): ProbeContext => ({
  root: fixturePath(),
  files,
  configFiles,
  project,
  exec: () => Promise.resolve({ stdout: "", stderr: "exec is not available in tests", code: 1 }),
  execNode: () => Promise.resolve({ stdout: "", stderr: "exec is not available in tests", code: 1 }),
  readText: () => Promise.resolve(undefined),
});

export interface ContextOverrides {
  readonly project?: ProjectFacts;
  readonly configFiles?: readonly ConfigFile[];
  readonly exec?: ProbeContext["exec"];
  readonly execNode?: ProbeContext["execNode"];
  readonly readText?: ProbeContext["readText"];
  readonly root?: string;
}

/** Canned tool output, so a probe's parsing is tested without installing the tool. */
export const execReturning =
  (stdout: string, code = 0): ProbeContext["exec"] =>
  (_command, args) =>
    Promise.resolve(args.includes("--version") ? { stdout: "9.9.9", stderr: "", code: 0 } : { stdout, stderr: "", code });

export const contextWith = (files: readonly SourceFile[], overrides: ContextOverrides = {}): ProbeContext => ({
  root: overrides.root ?? fixturePath(),
  files,
  configFiles: overrides.configFiles ?? [],
  project: overrides.project ?? { typescript: true, installed: true, stacks: ["ts"] },
  exec: overrides.exec ?? (() => Promise.resolve({ stdout: "", stderr: "no exec in tests", code: 1 })),
  execNode: overrides.exec ?? (() => Promise.resolve({ stdout: "", stderr: "no exec in tests", code: 1 })),
  readText: overrides.readText ?? (() => Promise.resolve(undefined)),
});
