import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { main } from "../packages/chaff/src/cli.ts";

// The command line run in a fresh directory holding the given files, with what it printed and its exit code.

export type CliRun = { readonly code: number; readonly out: string; readonly err: string; readonly dir: string };

export const runCli = async (files: Readonly<Record<string, string>>, args: readonly string[], lang = "ja_JP.UTF-8"): Promise<CliRun> => {
  const dir = mkdtempSync(join(tmpdir(), "chaff-cli-"));
  Object.entries(files).forEach(([name, body]) => writeFileSync(join(dir, name), body));
  const out: string[] = [];
  const err: string[] = [];
  const saved = { log: console.log, error: console.error, cwd: process.cwd(), lang: process.env["LANG"], all: process.env["LC_ALL"] };
  console.log = (...parts: unknown[]) => {
    out.push(parts.join(" "));
  };
  console.error = (...parts: unknown[]) => {
    err.push(parts.join(" "));
  };
  delete process.env["LC_ALL"];
  process.env["LANG"] = lang;
  process.chdir(dir);
  try {
    return { code: await main(args), out: out.join("\n"), err: err.join("\n"), dir };
  } finally {
    process.chdir(saved.cwd);
    console.log = saved.log;
    console.error = saved.error;
    if (saved.lang === undefined) delete process.env["LANG"];
    else process.env["LANG"] = saved.lang;
    if (saved.all !== undefined) process.env["LC_ALL"] = saved.all;
  }
};
