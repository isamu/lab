import type { FileKind, StackAdapter, StackDetection } from "scoria/plugin";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const IGNORED_SEGMENTS = ["node_modules", ".git", "dist", "lib", "build", "coverage", ".next", "out", ".turbo"];
const TEST_SEGMENTS = ["test", "tests", "__tests__", "__mocks__", "e2e"];
const SOURCE_EXTENSIONS = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs"];
const CONFIG_STEMS = ["eslint.config", "vite.config", "vitest.config", "rollup.config", "jest.config", "tsup.config"];

const segmentsOf = (relativePath: string): readonly string[] => relativePath.split("/");

const basenameOf = (relativePath: string): string => segmentsOf(relativePath).at(-1) ?? relativePath;

const hasExtension = (name: string): boolean => SOURCE_EXTENSIONS.some((ext) => name.endsWith(ext));

const isTestPath = (relativePath: string): boolean => {
  const name = basenameOf(relativePath);
  const inTestDirectory = segmentsOf(relativePath)
    .slice(0, -1)
    .some((s) => TEST_SEGMENTS.includes(s));
  return inTestDirectory || /\.(test|spec)\./.test(name) || /^test_/.test(name);
};

const isConfigPath = (name: string): boolean =>
  name.endsWith(".config.ts") || name.endsWith(".config.js") || CONFIG_STEMS.some((stem) => name.startsWith(stem));

export const classify = (relativePath: string): FileKind => {
  const name = basenameOf(relativePath);
  if (segmentsOf(relativePath).some((s) => IGNORED_SEGMENTS.includes(s))) return "ignored";
  if (!hasExtension(name)) return "ignored";
  if (name.endsWith(".d.ts") || name.endsWith(".min.js")) return "generated";
  if (isTestPath(relativePath)) return "test";
  if (isConfigPath(name)) return "config";
  return "source";
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const readPackageJson = async (root: string): Promise<Record<string, unknown> | undefined> => {
  try {
    const parsed: unknown = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
};

const detect = async (root: string): Promise<StackDetection> => {
  const pkg = await readPackageJson(root);
  const devDependencies = pkg?.["devDependencies"];
  const hasTypescript = isRecord(devDependencies) && "typescript" in devDependencies;
  return {
    matched: true,
    confidence: hasTypescript ? 1 : 0.6,
    evidence: hasTypescript ? ["devDependencies.typescript"] : [],
  };
};

export const stackTs: StackAdapter = { kind: "stack", id: "ts", apiVersion: 1, detect, classify };
