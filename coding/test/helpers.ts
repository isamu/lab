import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { FileKind, ProbeContext, SourceFile } from "../packages/scoria/src/plugin.ts";

const here = dirname(fileURLToPath(import.meta.url));

export const fixturePath = (...parts: readonly string[]): string => join(here, "fixtures", ...parts);

/**
 * fixture を SourceFile として読む。classify は通さない。
 * fixture は test/ 配下にあるので classify に掛けると全部 "test" になり、
 * source を対象にする probe が何も見なくなる。
 */
export const loadFixture = async (relative: string, kind: FileKind = "source"): Promise<SourceFile> => {
  const text = await readFile(fixturePath(relative), "utf8");
  return { path: relative, kind, lines: text.split("\n") };
};

export const contextOf = (files: readonly SourceFile[]): ProbeContext => ({
  root: fixturePath(),
  files,
  exec: () => Promise.resolve({ stdout: "", stderr: "exec is not available in tests", code: 1 }),
});
