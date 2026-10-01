#!/usr/bin/env node
// On an old Node.js the CLI fails while it loads, with a SyntaxError that does not name the version. Check first.
import { readFileSync } from "node:fs";
import { tooOldMessage } from "../dist/node-version.js";

const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const tooOld = tooOldMessage(process.versions.node, manifest.engines.node, process.env);
if (tooOld === undefined) {
  const { main } = await import("../dist/cli.js");
  process.exitCode = await main(process.argv.slice(2));
} else {
  console.error(tooOld);
  process.exitCode = 1;
}
