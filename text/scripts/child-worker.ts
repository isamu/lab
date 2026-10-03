// One process of scripts/in-children.ts: calls a module's export with the jobs in a JSON file and writes its results to another.
//   node scripts/child-worker.ts <module url> <export> <jobs.json> <results.json>
import { readFileSync, writeFileSync } from "node:fs";

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const [moduleUrl, exportName, input, output] = process.argv.slice(2);
if (moduleUrl === undefined || exportName === undefined || input === undefined || output === undefined)
  throw new Error("usage: node scripts/child-worker.ts <module url> <export> <jobs.json> <results.json>");
const module: unknown = await import(moduleUrl);
const run: unknown = isRecord(module) ? module[exportName] : undefined;
if (typeof run !== "function") throw new Error(`child-worker: ${moduleUrl} does not export a function ${exportName}`);
const jobs: unknown = JSON.parse(readFileSync(input, "utf8"));
const results: unknown = await Reflect.apply(run, undefined, [jobs]);
writeFileSync(output, JSON.stringify(results), "utf8");
