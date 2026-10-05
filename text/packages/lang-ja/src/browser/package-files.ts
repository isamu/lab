import { packageFiles } from "chaffjs/browser-files";

// package-files.ts in a build without a file system: this package's lexicons from memory, rooted at /@chaffjs/lang-ja.

const files = packageFiles("@chaffjs/lang-ja");

export const PACKAGE_DIR = files.root;

/** Paths here are made only from PACKAGE_DIR and file names, so joining them needs no normalising. */
export const joinPath = (...parts: readonly string[]): string => parts.join("/");

export const readText = (path: string): string => files.readText(path);

export const readDir = (path: string): string[] => files.readDir(path);
