import { packageFiles } from "chaffjs/browser-files";

// package-files.ts in a build without a file system: this package's lexicons and word list from memory, rooted at
// /@chaffjs/lang-en.

const files = packageFiles("@chaffjs/lang-en");

export const PACKAGE_DIR = files.root;

/** Paths here are made only from PACKAGE_DIR and file names, so joining them needs no normalising. */
export const joinPath = (...parts: readonly string[]): string => parts.join("/");

export const readText = (path: string): string => files.readText(path);

export const readDir = (path: string): string[] => files.readDir(path);
