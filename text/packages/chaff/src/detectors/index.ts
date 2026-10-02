import { readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { extname, join } from "node:path";
import type { Detector } from "../plugin.ts";
import { registryEntries } from "./registry-files.ts";

// Each detector is registered by its own file, registry/<how_to_find>.ts, so a new rule adds a file and edits no shared
// list. require (not import) keeps DETECTORS ready synchronously, without a top-level await in every importer.
const REGISTRY_DIR = join(import.meta.dirname, "registry");
const requireModule = createRequire(import.meta.url);

const detectorOf = (loaded: unknown): unknown => (typeof loaded === "object" && loaded !== null && "detector" in loaded ? loaded.detector : undefined);

const isDetector = (value: unknown): value is Detector => typeof value === "function";

const loadDetector = (file: string): Detector => {
  const path = join(REGISTRY_DIR, file);
  const detector = detectorOf(requireModule(path));
  if (!isDetector(detector)) throw new Error(`chaff: ${path} must export a function named detector`);
  return detector;
};

/** rule 定義の how_to_find がここを引く。rule 側は実装を知らない。 */
export const DETECTORS: Readonly<Record<string, Detector>> = Object.fromEntries(
  registryEntries(readdirSync(REGISTRY_DIR), extname(import.meta.filename)).map(({ file, howToFind }) => [howToFind, loadDetector(file)]),
);
