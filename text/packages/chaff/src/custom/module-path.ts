import { isAbsolute, relative, resolve, sep } from "node:path";

// Where a type: module rule's file is. Loading it runs its code, so a relative path may not leave the folder chaff.yaml
// is in: a chaff.yaml copied from elsewhere cannot reach for ../../somewhere. An absolute path is written on purpose and
// is used as written. Pure: no file is read.

export type ModulePathRefusal = "outside";

export type ModulePath = { readonly file: string } | { readonly refusal: ModulePathRefusal };

const isInside = (dir: string, file: string): boolean => {
  const fromDir = relative(dir, file);
  const leaves = fromDir === ".." || fromDir.startsWith(`..${sep}`);
  return fromDir !== "" && !leaves && !isAbsolute(fromDir);
};

/** The file a module path names, relative to baseDir (where chaff.yaml is) unless it is absolute. */
export const modulePathOf = (written: string, baseDir: string): ModulePath => {
  if (isAbsolute(written)) return { file: written };
  const file = resolve(baseDir, written);
  return isInside(baseDir, file) ? { file } : { refusal: "outside" };
};
