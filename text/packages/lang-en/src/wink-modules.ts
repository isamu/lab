import { createRequire } from "node:module";

// Where the wink tagger and its vocabulary come from. A build without a file system puts its own module in this one's place.

const require = createRequire(import.meta.url);

/** wink is CommonJS and holds its dictionary synchronously: from ESM it is taken with createRequire. */
export const winkPosTagger = (): unknown => require("wink-pos-tagger");

/** The vocabulary the tagger reads (word → Penn Treebank tags): the one wink-pos-tagger loads from its own dependency. */
export const winkLexiconWords = (): unknown => createRequire(require.resolve("wink-pos-tagger"))("wink-lexicon/src/lexicon.js");
