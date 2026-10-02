// Turns an OpenAI Evals samples file ({ input, ideal } per line) and the completions your harness collected
// ({ sample, completion } per line, `sample` being the line index) into a `chaff grade` items file. `ideal` becomes the
// reference whose facts the completion must keep.
// node to-chaff.mjs samples.jsonl completions.jsonl > items.jsonl && npx chaffjs grade items.jsonl --out results.jsonl
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** @typedef {{ input: unknown, ideal: string | string[] }} Sample */
/** @typedef {{ sample: number, completion: string }} Completion */
/** @typedef {{ id: string, output: string, reference: string | undefined }} ChaffItem */

/** @param {string} path @returns {unknown[]} */
const linesOf = (path) =>
  readFileSync(path, "utf8")
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => /** @type {unknown} */ (JSON.parse(line)));

/** An `ideal` may be a list of acceptable answers; the first is the reference. @param {string | string[] | undefined} ideal */
const referenceOf = (ideal) => (Array.isArray(ideal) ? ideal[0] : ideal);

/** @param {readonly Sample[]} samples @param {readonly Completion[]} completions @returns {ChaffItem[]} */
export const toChaffItems = (samples, completions) =>
  completions.map(({ sample, completion }) => ({ id: `sample-${String(sample)}`, output: completion, reference: referenceOf(samples[sample]?.ideal) }));

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [samplesPath = "samples.jsonl", completionsPath = "completions.jsonl"] = process.argv.slice(2);
  const samples = /** @type {Sample[]} */ (linesOf(samplesPath));
  const completions = /** @type {Completion[]} */ (linesOf(completionsPath));
  toChaffItems(samples, completions).forEach((item) => console.log(JSON.stringify(item)));
}
