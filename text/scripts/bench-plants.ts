// What a rule declares for `yarn bench` in files of its own, so a new rule edits no shared list:
// test/fixtures/bench/plants/<rule>.yaml says whether the bench plants a mistake for it, and a module in
// scripts/bench-plants/ exports MUTATIONS, the mistakes it plants. Both directories are read in file-name order.
import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { parse } from "yaml";
import { planOfFiles, type PlantPlan } from "./bench-coverage.ts";
import type { Mutation } from "./bench-text.ts";

const PLANTS_DIR = join(import.meta.dirname, "..", "test", "fixtures", "bench", "plants");
const MUTATIONS_DIR = join(import.meta.dirname, "bench-plants");
const requireModule = createRequire(import.meta.url);

const byName = (left: string, right: string): number => left.localeCompare(right, "en");

const filesIn = (dir: string, extension: string): string[] =>
  readdirSync(dir)
    .filter((file) => file.endsWith(extension))
    .toSorted(byName);

/** The committed plan, from test/fixtures/bench/plants/<rule>.yaml. */
export const loadPlan = (): PlantPlan =>
  planOfFiles(new Map(filesIn(PLANTS_DIR, ".yaml").map((file) => [file.slice(0, -".yaml".length), parse(readFileSync(join(PLANTS_DIR, file), "utf8"))])));

const isMutation = (value: unknown): value is Mutation =>
  typeof value === "object" &&
  value !== null &&
  "id" in value &&
  typeof value.id === "string" &&
  "rule" in value &&
  typeof value.rule === "string" &&
  "languages" in value &&
  Array.isArray(value.languages) &&
  "plant" in value &&
  typeof value.plant === "function";

const mutationsOf = (file: string): Mutation[] => {
  const path = join(MUTATIONS_DIR, file);
  const loaded: unknown = requireModule(path);
  const mutations = typeof loaded === "object" && loaded !== null && "MUTATIONS" in loaded ? loaded.MUTATIONS : undefined;
  if (!Array.isArray(mutations) || !mutations.every(isMutation)) throw new Error(`bench: ${path} must export MUTATIONS, a list of mutations`);
  return mutations;
};

/** The mutations of every module in scripts/bench-plants/, in file-name order. */
export const registeredMutations = (): Mutation[] => filesIn(MUTATIONS_DIR, ".ts").flatMap(mutationsOf);
