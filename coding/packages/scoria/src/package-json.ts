import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

export const readPackageJson = async (root: string): Promise<Record<string, unknown> | undefined> => {
  try {
    const parsed: unknown = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
};

const DEPENDENCY_FIELDS = ["dependencies", "devDependencies", "peerDependencies"];

export const hasDependency = (pkg: unknown, name: string): boolean =>
  isRecord(pkg) &&
  DEPENDENCY_FIELDS.some((field) => {
    const group = pkg[field];
    return isRecord(group) && name in group;
  });
