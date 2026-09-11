import { readdir, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import type { FileKind, SourceFile } from "./plugin.ts";

const MAX_BYTES = 2_000_000;

const toPosix = (value: string): string => value.split(sep).join("/");

const walk = async (root: string, directory: string, found: string[]): Promise<void> => {
  const entries = await readdir(directory, { withFileTypes: true });
  await Promise.all(
    entries.map(async (entry) => {
      const full = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name.startsWith(".")) return;
        await walk(root, full, found);
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
 * 走査・読み込み・分類を core が一度だけ行い、probe には分類済みのものだけを渡す。
 * probe が生のパスを受け取らないので、classify を迂回した種別判定が書けない（spec §8）。
 */
export const collectFiles = async (root: string, classify: (relativePath: string) => FileKind): Promise<readonly SourceFile[]> => {
  const paths: string[] = [];
  await walk(root, root, paths);
  const candidates = paths.map((path) => ({ path, kind: classify(path) })).filter((f) => f.kind !== "ignored");
  const loaded = await Promise.all(
    candidates.map(async ({ path, kind }) => {
      const lines = await readLines(root, path);
      return lines === undefined ? undefined : { path, kind, lines };
    }),
  );
  return loaded.filter((f): f is SourceFile => f !== undefined);
};

export const slocOf = (file: SourceFile): number => file.lines.filter((line) => line.trim() !== "").length;

/** 密度の分母は source だけ。test を分母に入れると、テストを足すだけで密度が下がる（spec §16.3）。 */
export const sourceSloc = (files: readonly SourceFile[]): number => files.filter((f) => f.kind === "source").reduce((sum, f) => sum + slocOf(f), 0);
