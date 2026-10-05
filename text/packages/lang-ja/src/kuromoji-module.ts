import { createRequire } from "node:module";
import { dirname, join } from "node:path";

// Where kuromoji and its dictionary come from. A build without a file system puts its own module in this one's place.

const require = createRequire(import.meta.url);

/** kuromoji is CommonJS: from ESM it is taken with createRequire. */
export const kuromojiModule = (): unknown => require("@sglkc/kuromoji");

/** The dictionary folder kuromoji ships. */
export const kuromojiDictionaryPath = (): string => join(dirname(require.resolve("@sglkc/kuromoji/package.json")), "dict");
