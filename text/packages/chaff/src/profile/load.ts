import { join } from "node:path";
import { parse } from "yaml";
import { PACKAGE_DIR, readDir, readText } from "../package-files.ts";
import { parseProfile, type ProfileDefinition } from "./parse.ts";

const PROFILES_DIR = join(PACKAGE_DIR, "profiles");

const loaded: { value: readonly ProfileDefinition[] | undefined } = { value: undefined };

/** 同梱の profiles/*.yaml。一度だけ読む。 */
export const loadProfiles = (): readonly ProfileDefinition[] => {
  loaded.value ??= readDir(PROFILES_DIR)
    .filter((file) => file.endsWith(".yaml"))
    .toSorted((left, right) => left.localeCompare(right))
    .flatMap((file) => {
      const path = join(PROFILES_DIR, file);
      try {
        const definition = parseProfile(parse(readText(path)));
        return definition === undefined ? [] : [definition];
      } catch (error) {
        throw new Error(`cannot read the profile ${path}: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
      }
    });
  return loaded.value;
};
