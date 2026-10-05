import { join } from "node:path";
import { parse } from "yaml";
import { PACKAGE_DIR, readText } from "../package-files.ts";
import { parseStructureBaseline, type StructureBaseline } from "./baseline.ts";

const BASELINE_FILE = join(PACKAGE_DIR, "structure-baseline.yaml");

const readBaseline = (): StructureBaseline => {
  try {
    return parseStructureBaseline(parse(readText(BASELINE_FILE)));
  } catch (error) {
    throw new Error(`cannot read the structure baseline ${BASELINE_FILE}`, { cause: error });
  }
};

/** The human baseline shipped with chaff (structure-baseline.yaml), by language. */
export const STRUCTURE_BASELINE: StructureBaseline = readBaseline();
