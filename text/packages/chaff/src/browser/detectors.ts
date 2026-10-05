import type { CrossDetector, Detector } from "../plugin.ts";
import { registryEntries } from "../detectors/registry-files.ts";

// detectors/index.ts in a bundle: the registry folders cannot be listed at run time, so the bundler lists them
// (import.meta.glob) when it builds. The same files, named and checked as registry-load.ts names and checks them.

type Loaded = Readonly<Record<string, unknown>>;

const isDetector = (value: unknown): value is Detector => typeof value === "function";

const isCrossDetector = (value: unknown): value is CrossDetector => typeof value === "function";

const fileName = (path: string): string => path.slice(path.lastIndexOf("/") + 1);

/** From src the files end in .ts, from dist in .js (with .d.ts beside them, which registryEntries leaves out). */
const registryOf = <T>(loaded: Loaded, isWanted: (value: unknown) => value is T): Readonly<Record<string, T>> => {
  const byName = new Map(Object.entries(loaded).map(([path, detector]) => [fileName(path), detector]));
  const names = [...byName.keys()];
  const extension = names.some((name) => name.endsWith(".js")) ? ".js" : ".ts";
  return Object.fromEntries(
    registryEntries(names, extension).map(({ file, howToFind }) => {
      const detector = byName.get(file);
      if (!isWanted(detector)) throw new Error(`chaff: ${file} must export a function named detector`);
      return [howToFind, detector];
    }),
  );
};

export const DETECTORS: Readonly<Record<string, Detector>> = registryOf(
  import.meta.glob(["../detectors/registry/*.ts", "../detectors/registry/*.js", "!../detectors/registry/*.d.ts"], { eager: true, import: "detector" }),
  isDetector,
);

export const CROSS_DETECTORS: Readonly<Record<string, CrossDetector>> = registryOf(
  import.meta.glob(["../detectors/cross-registry/*.ts", "../detectors/cross-registry/*.js", "!../detectors/cross-registry/*.d.ts"], {
    eager: true,
    import: "detector",
  }),
  isCrossDetector,
);
