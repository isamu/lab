// `chaffjs/browser`: chaff in a web page, with no file system and no server. Each package's files (rules, lexicons)
// come from setupBrowser's `files`, asked for only when needed: chaff's own at the first check, a language's at the
// first text in it. Nothing the page checks is sent anywhere. Built for a bundler that reads package.json's "browser"
// field and import.meta.glob (Vite).
import { ensurePackageFiles, setupBrowserFiles, type BrowserSetup } from "chaffjs/browser-files";
import type { BrowserCheck, BrowserCheckOptions } from "./browser/check-text.ts";

export type { BrowserSetup, PackageFiles } from "chaffjs/browser-files";
export type { BrowserCheck, BrowserCheckOptions, BrowserFinding } from "./browser/check-text.ts";
export type { NotRunEntry } from "./grade/result.ts";

export const setupBrowser = (setup: BrowserSetup): void => setupBrowserFiles(setup);

/** Checks one text as `chaff <file>` does, and returns its findings and the rules that did not run, with why. */
export const check = async (text: string, options: BrowserCheckOptions = {}): Promise<BrowserCheck> => {
  await ensurePackageFiles("chaffjs");
  const { checkText } = await import("./browser/check-text.ts");
  return checkText(text, options);
};
