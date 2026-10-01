#!/usr/bin/env node
// On an old Node.js the CLI fails while it loads, with a SyntaxError that does not name the version. Check first,
// with what Node.js 12 already reads: no top-level await, no "node:" imports.
import { readFileSync } from "fs";
import { tooOldMessage } from "../dist/node-version.js";

const run = async () => {
  const { main } = await import("../dist/cli.js");
  process.exitCode = await main(process.argv.slice(2));
};

const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const tooOld = tooOldMessage(process.versions.node, manifest.engines.node, process.env);
if (tooOld === undefined) {
  void run();
} else {
  console.error(tooOld);
  process.exitCode = 1;
}
