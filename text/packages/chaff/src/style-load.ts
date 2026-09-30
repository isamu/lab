import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { parseStyle, type StyleDefinition } from "./style-parse.ts";

const STYLES_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "styles");

const loaded: { value: readonly StyleDefinition[] | undefined } = { value: undefined };

const readStyle = (dir: string, file: string): StyleDefinition => {
  try {
    return parseStyle(parse(readFileSync(join(dir, file), "utf8")), file);
  } catch (error) {
    throw new Error(`cannot read ${join(dir, file)}: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }
};

/** The bundled house styles (styles/*.yaml), by file name. Read once. */
export const loadStyles = (dir: string = STYLES_DIR): readonly StyleDefinition[] => {
  if (dir === STYLES_DIR && loaded.value !== undefined) return loaded.value;
  const styles = readdirSync(dir)
    .filter((file) => file.endsWith(".yaml"))
    .toSorted((left, right) => left.localeCompare(right, "en"))
    .map((file) => readStyle(dir, file));
  if (dir === STYLES_DIR) loaded.value = styles;
  return styles;
};
