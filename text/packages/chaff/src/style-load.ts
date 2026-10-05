import { join } from "node:path";
import { parse } from "yaml";
import { PACKAGE_DIR, readDir, readText } from "./package-files.ts";
import { parseStyle, type StyleDefinition } from "./style-parse.ts";

const STYLES_DIR = join(PACKAGE_DIR, "styles");

const loaded: { value: readonly StyleDefinition[] | undefined } = { value: undefined };

const readStyle = (dir: string, file: string): StyleDefinition => {
  try {
    return parseStyle(parse(readText(join(dir, file))), file);
  } catch (error) {
    throw new Error(`cannot read ${join(dir, file)}: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }
};

/** The bundled house styles (styles/*.yaml), by file name. Read once. */
export const loadStyles = (dir: string = STYLES_DIR): readonly StyleDefinition[] => {
  if (dir === STYLES_DIR && loaded.value !== undefined) return loaded.value;
  const styles = readDir(dir)
    .filter((file) => file.endsWith(".yaml"))
    .toSorted((left, right) => left.localeCompare(right, "en"))
    .map((file) => readStyle(dir, file));
  if (dir === STYLES_DIR) loaded.value = styles;
  return styles;
};
