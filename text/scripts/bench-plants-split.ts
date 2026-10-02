// Moves the entries of the old test/fixtures/bench/plants.yaml (planted: and not_planted: maps) into one file per rule
// in test/fixtures/bench/plants/. For a branch that still adds a rule to plants.yaml: take its version, run this, delete it.
// A rule's file that exists with other content is reported and left alone.
//   node scripts/bench-plants-split.ts <plants.yaml>
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse, stringify } from "yaml";
import { planOf } from "./bench-coverage.ts";

const PLANTS_DIR = join(import.meta.dirname, "..", "test", "fixtures", "bench", "plants");

const plantedText = (languages: readonly string[]): string => `planted: [${languages.join(", ")}]\n`;
const notPlantedText = (reason: string): string => stringify({ not_planted: reason }, { lineWidth: 0 });

const write = (rule: string, text: string): string => {
  const path = join(PLANTS_DIR, `${rule}.yaml`);
  if (!existsSync(path)) {
    writeFileSync(path, text);
    return `created: ${rule}.yaml`;
  }
  return readFileSync(path, "utf8") === text ? "" : `differs, left alone: ${rule}.yaml`;
};

const [source] = process.argv.slice(2);
if (source === undefined) {
  console.error("usage: node scripts/bench-plants-split.ts <plants.yaml>");
  process.exitCode = 2;
} else {
  const plan = planOf(parse(readFileSync(source, "utf8")));
  const outcomes = [
    ...Object.entries(plan.planted).map(([rule, languages]) => write(rule, plantedText(languages))),
    ...Object.entries(plan.notPlanted).map(([rule, reason]) => write(rule, notPlantedText(reason))),
  ].filter((outcome) => outcome !== "");
  outcomes.forEach((outcome) => console.log(outcome));
  if (outcomes.some((outcome) => outcome.startsWith("differs"))) process.exitCode = 1;
}
