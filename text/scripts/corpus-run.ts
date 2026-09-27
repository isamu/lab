// Runs chaff's structure rules over every committed corpus document and prints what they find, grouped by rule.
// A statute in force is internally consistent, so every finding here is a candidate false positive to explain.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { structureFindings, type CorpusFinding } from "./corpus-findings.ts";

const LAWS = join(dirname(fileURLToPath(import.meta.url)), "..", "corpus", "laws");
const verbose = process.argv.includes("--verbose");

const summaryOf = (findings: readonly CorpusFinding[]): string => {
  const counts = findings.reduce<Record<string, number>>((acc, finding) => ({ ...acc, [finding.rule]: (acc[finding.rule] ?? 0) + 1 }), {});
  const parts = Object.entries(counts).map(([rule, count]) => `${rule} ${String(count)}`);
  return parts.length === 0 ? "clean" : parts.join(", ");
};

const files = readdirSync(LAWS).filter((file) => file.endsWith(".txt"));
await files.reduce<Promise<void>>(async (previous, file) => {
  await previous;
  const findings = await structureFindings(file, readFileSync(join(LAWS, file), "utf8"));
  console.log(`${file}  ${summaryOf(findings)}`);
  if (verbose) findings.forEach((finding) => console.log(`  ${String(finding.line)}  ${finding.rule}  ${finding.message}`));
}, Promise.resolve());
