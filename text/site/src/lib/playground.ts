// The playground's client side: chaff from chaffjs/browser, its files and kuromoji's dictionary fetched from this site
// (public/playground/, made by scripts/browser-files.ts before every build). Nothing else goes over the network.
import { check, setupBrowser, type BrowserCheck, type BrowserFinding, type PackageFiles } from "../../../packages/chaff/src/browser.ts";

const PLAYGROUND = `${import.meta.env.BASE_URL.replace(/\/?$/u, "/")}playground/`;

const isTextMap = (value: unknown): value is PackageFiles =>
  typeof value === "object" && value !== null && !Array.isArray(value) && Object.values(value).every((text) => typeof text === "string");

const filesOf = async (packageName: string): Promise<PackageFiles> => {
  const url = `${PLAYGROUND}files/${packageName}.json`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${String(response.status)}`);
  const files: unknown = await response.json();
  if (!isTextMap(files)) throw new Error(`${url}: not a map of files`);
  return files;
};

setupBrowser({ files: filesOf, kuromojiDictionaryUrl: new URL(`${PLAYGROUND}kuromoji/`, window.location.href).href });

/** "" (from the text), ja or en; "" genre leaves it to chaff, as a file with no genre set. */
export const checkText = (text: string, language: string, genre: string): Promise<BrowserCheck> =>
  check(text, { language: language === "" ? undefined : language, genre: genre === "" ? undefined : genre });

/** One line of the text and the findings on it, in the order of the text. */
export type LineFindings = { readonly line: number; readonly text: string; readonly findings: readonly BrowserFinding[] };

export const findingsByLine = (text: string, findings: readonly BrowserFinding[]): LineFindings[] => {
  const lines = text.split(/\r?\n/u);
  const byLine = findings.reduce<Map<number, BrowserFinding[]>>(
    (acc, finding) => acc.set(finding.line, [...(acc.get(finding.line) ?? []), finding]),
    new Map(),
  );
  return [...byLine.entries()]
    .toSorted(([left], [right]) => left - right)
    .map(([line, onLine]) => ({
      line,
      text: lines[line - 1] ?? "",
      findings: onLine.toSorted((left, right) => left.column - right.column),
    }));
};
