import type { FileKind, StackAdapter, StackDetection } from "../plugin.ts";
import { isRecord, readPackageJson, hasDependency } from "../package-json.ts";
import { basenameOf, isIgnoredPath, isTestPath } from "./paths.ts";

const TYPED_EXTENSIONS = [".ts", ".tsx", ".mts", ".cts"];
const UNTYPED_EXTENSIONS = [".js", ".jsx", ".mjs", ".cjs"];
const CONFIG_STEMS = ["eslint.config", "vite.config", "vitest.config", "rollup.config", "jest.config", "tsup.config"];

export const SOURCE_EXTENSIONS = [...TYPED_EXTENSIONS, ...UNTYPED_EXTENSIONS];

export const isUntypedSource = (relativePath: string): boolean => UNTYPED_EXTENSIONS.some((extension) => relativePath.endsWith(extension));

const isConfigName = (name: string): boolean =>
  name.endsWith(".config.ts") || name.endsWith(".config.js") || CONFIG_STEMS.some((stem) => name.startsWith(stem));

export const classify = (relativePath: string): FileKind => {
  const name = basenameOf(relativePath);
  if (isIgnoredPath(relativePath)) return "ignored";
  if (!SOURCE_EXTENSIONS.some((extension) => name.endsWith(extension))) return "ignored";
  if (name.endsWith(".d.ts") || name.endsWith(".min.js")) return "generated";
  if (isTestPath(relativePath)) return "test";
  if (isConfigName(name)) return "config";
  return "source";
};

const detect = async (root: string): Promise<StackDetection> => {
  const pkg = await readPackageJson(root);
  const evidence = hasDependency(pkg, "typescript") ? ["devDependencies.typescript"] : [];
  return { matched: true, confidence: evidence.length > 0 ? 1 : 0.6, evidence };
};

export const stackTs: StackAdapter = { kind: "stack", id: "ts", apiVersion: 1, detect, classify };

export const isTypeScriptProject = (pkg: unknown): boolean => isRecord(pkg) && hasDependency(pkg, "typescript");
