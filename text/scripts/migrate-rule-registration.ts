// Moves detectors registered in the old hand-written DETECTORS map into registry files, one per how_to_find.
// usage: node scripts/migrate-rule-registration.ts <old detectors/index.ts>
// A file that already exists with the same text is left alone; one with other text is reported and not overwritten.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { registrationsIn, registryFileText, type Registration } from "./rule-registration.ts";

const REGISTRY_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "packages", "chaff", "src", "detectors", "registry");

type Outcome = "created" | "unchanged" | "differs";

const migrate = (registration: Registration): Outcome => {
  const path = join(REGISTRY_DIR, `${registration.howToFind}.ts`);
  const text = registryFileText(registration);
  if (existsSync(path)) return readFileSync(path, "utf8") === text ? "unchanged" : "differs";
  writeFileSync(path, text);
  return "created";
};

const main = (): number => {
  const [oldIndex] = process.argv.slice(2);
  if (oldIndex === undefined) {
    console.error("usage: node scripts/migrate-rule-registration.ts <old detectors/index.ts>");
    return 2;
  }
  const outcomes = registrationsIn(readFileSync(oldIndex, "utf8")).map((registration) => ({ registration, outcome: migrate(registration) }));
  outcomes
    .filter(({ outcome }) => outcome !== "unchanged")
    .forEach(({ registration, outcome }) => console.log(`${outcome}: registry/${registration.howToFind}.ts`));
  return outcomes.some(({ outcome }) => outcome === "differs") ? 1 : 0;
};

process.exitCode = main();
