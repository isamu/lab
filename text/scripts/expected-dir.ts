// An expectation kept as a directory of .txt files, one per rule plus "_"-prefixed shared ones, so that PRs changing
// different rules edit different files. Reads and writes the files; splitting and joining the lines is the caller's.
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const isExpectationFile = (file: string): boolean => file.endsWith(".txt");

const linesOf = (path: string): string[] =>
  readFileSync(path, "utf8")
    .split("\n")
    .filter((line) => line !== "");

/** Every .txt file in the directory by name, as its non-empty lines. No directory reads as no files. */
export const readExpectedDir = (dir: string): Map<string, string[]> =>
  existsSync(dir)
    ? new Map(
        readdirSync(dir)
          .filter(isExpectationFile)
          .map((file): [string, string[]] => [file, linesOf(join(dir, file))]),
      )
    : new Map<string, string[]>();

/** Writes each file, and removes the .txt files the new expectation no longer has (a rule with nothing left). */
export const writeExpectedDir = (dir: string, files: ReadonlyMap<string, readonly string[]>): void => {
  mkdirSync(dir, { recursive: true });
  readdirSync(dir)
    .filter((file) => isExpectationFile(file) && !files.has(file))
    .forEach((file) => rmSync(join(dir, file)));
  files.forEach((lines, file) => writeFileSync(join(dir, file), `${lines.join("\n")}\n`));
};
