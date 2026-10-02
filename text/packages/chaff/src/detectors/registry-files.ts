/** A file in detectors/registry/ and the how_to_find it serves: its name without the extension. */
export type RegistryEntry = { readonly file: string; readonly howToFind: string };

/**
 * The registry files among a directory's names, in name order. Only names ending in the extension of the running module
 * count: from src that is .ts, from dist .js, where the .d.ts and .map files beside them are not detectors.
 */
export const registryEntries = (names: readonly string[], extension: string): RegistryEntry[] =>
  names
    .filter((name) => name.endsWith(extension) && !name.endsWith(`.d${extension}`) && name.length > extension.length)
    .toSorted((left, right) => left.localeCompare(right, "en"))
    .map((file) => ({ file, howToFind: file.slice(0, -extension.length) }));
