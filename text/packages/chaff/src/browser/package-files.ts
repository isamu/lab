import { packageFiles } from "chaffjs/browser-files";

// package-files.ts in a build without a file system: chaff's files from memory, rooted at /chaffjs.

const files = packageFiles("chaffjs");

export const PACKAGE_DIR = files.root;

export const readText = (path: string): string => files.readText(path);

export const readDir = (path: string): string[] => files.readDir(path);

export const exists = (path: string): boolean => files.exists(path);
