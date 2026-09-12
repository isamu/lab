import { readdir, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import type { SourceFile, StackAdapter } from "./plugin.ts";
import { composeClassify, ownerOf } from "./stacks/index.ts";

const MAX_BYTES = 2_000_000;

const toPosix = (value: string): string => value.split(sep).join("/");

const walk = async (root: string, directory: string, found: string[], exclude: ReadonlySet<string>): Promise<void> => {
  const entries = await readdir(directory, { withFileTypes: true });
  await Promise.all(
    entries.map(async (entry) => {
      const full = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name.startsWith(".") || exclude.has(full)) return;
        await walk(root, full, found, exclude);
        return;
      }
      if (entry.isFile()) found.push(toPosix(relative(root, full)));
    }),
  );
};

const readLines = async (root: string, relativePath: string): Promise<readonly string[] | undefined> => {
  try {
    const text = await readFile(join(root, relativePath), { encoding: "utf8" });
    return text.length > MAX_BYTES ? undefined : text.split("\n");
  } catch {
    return undefined;
  }
};

/**
 * Walking, reading and classification happen once, in the core; probes only ever see the result.
 * Because a probe never receives a raw path, a kind check that bypasses classify cannot be
 * written (spec §8).
 */
export const collectFiles = async (root: string, stacks: readonly StackAdapter[], exclude: readonly string[] = []): Promise<readonly SourceFile[]> => {
  const classify = composeClassify(stacks);
  const paths: string[] = [];
  await walk(root, root, paths, new Set(exclude));
  const candidates = paths.map((path) => ({ path, kind: classify(path) })).filter((file) => file.kind !== "ignored");
  const loaded = await Promise.all(
    candidates.map(async ({ path, kind }) => {
      const lines = await readLines(root, path);
      if (lines === undefined) return undefined;
      const codeLinesOf = ownerOf(stacks, path)?.codeLinesOf;
      return { path, kind, lines, codeLines: codeLinesOf === undefined ? lines : codeLinesOf(lines) };
    }),
  );
  return loaded.filter((file): file is SourceFile => file !== undefined);
};

export const slocOf = (file: SourceFile): number => file.lines.filter((line) => line.trim() !== "").length;

/** Only source counts toward the denominator. Including tests would let adding tests dilute any density (spec §16.3). */
export const sourceSloc = (files: readonly SourceFile[]): number => files.filter((file) => file.kind === "source").reduce((sum, file) => sum + slocOf(file), 0);
