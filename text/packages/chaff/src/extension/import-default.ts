import { pathToFileURL } from "node:url";

const firstLine = (error: unknown): string => (error instanceof Error ? error.message : String(error)).split("\n")[0] ?? "";

/** A module's default export, or the first line of why it could not be imported (a syntax error, a missing import). Running it runs its code. */
export const importDefault = async (file: string): Promise<{ readonly exported: unknown } | { readonly message: string }> => {
  try {
    const namespace: unknown = await import(pathToFileURL(file).href);
    return { exported: typeof namespace === "object" && namespace !== null && "default" in namespace ? namespace.default : undefined };
  } catch (error) {
    return { message: firstLine(error) };
  }
};
