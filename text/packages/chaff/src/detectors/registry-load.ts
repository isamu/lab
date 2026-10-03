import { existsSync, readdirSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { registryEntries } from "./registry-files.ts";

// require (not import) keeps a registry ready synchronously, without a top-level await in every importer.
const requireModule = createRequire(import.meta.url);

const detectorOf = (loaded: unknown): unknown => (typeof loaded === "object" && loaded !== null && "detector" in loaded ? loaded.detector : undefined);

/**
 * The detectors of a registry directory, one file per how_to_find, each exporting a function named detector.
 * extension is that of the running module (.ts from src, .js from dist). A directory that is not there holds none.
 */
export const loadRegistry = <T>(dir: string, extension: string, isDetector: (value: unknown) => value is T): Readonly<Record<string, T>> =>
  Object.fromEntries(
    registryEntries(existsSync(dir) ? readdirSync(dir) : [], extension).map(({ file, howToFind }) => {
      const path = join(dir, file);
      const detector = detectorOf(requireModule(path));
      if (!isDetector(detector)) throw new Error(`chaff: ${path} must export a function named detector`);
      return [howToFind, detector];
    }),
  );
