import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { parseStructureBaseline, type StructureBaseline } from "./baseline.ts";

const BASELINE_FILE = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "structure-baseline.yaml");

const readBaseline = (): StructureBaseline => {
  try {
    return parseStructureBaseline(parse(readFileSync(BASELINE_FILE, "utf8")));
  } catch (error) {
    throw new Error(`cannot read the structure baseline ${BASELINE_FILE}`, { cause: error });
  }
};

/** The human baseline shipped with chaff (structure-baseline.yaml), by language. */
export const STRUCTURE_BASELINE: StructureBaseline = readBaseline();
