import { extname, join } from "node:path";
import type { CrossDetector, Detector } from "../plugin.ts";
import { loadRegistry } from "./registry-load.ts";

// Each detector is registered by its own file, registry/<how_to_find>.ts, so a new rule adds a file and edits no shared
// list. A rule that compares the documents of one run registers in cross-registry/<how_to_find>.ts instead.

const isDetector = (value: unknown): value is Detector => typeof value === "function";

const isCrossDetector = (value: unknown): value is CrossDetector => typeof value === "function";

/** rule 定義の how_to_find がここを引く。rule 側は実装を知らない。 */
export const DETECTORS: Readonly<Record<string, Detector>> = loadRegistry(join(import.meta.dirname, "registry"), extname(import.meta.filename), isDetector);

/** The detectors of the rules that compare the documents of one run (requires: [documents]), by how_to_find. */
export const CROSS_DETECTORS: Readonly<Record<string, CrossDetector>> = loadRegistry(
  join(import.meta.dirname, "cross-registry"),
  extname(import.meta.filename),
  isCrossDetector,
);
