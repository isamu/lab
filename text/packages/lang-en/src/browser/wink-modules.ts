import winkPosTaggerModule from "wink-pos-tagger";
import winkLexicon from "wink-lexicon/src/lexicon.js";

// wink-modules.ts in a bundle: the tagger and its vocabulary bundled. The vocabulary is the module the tagger itself
// imports, so the bundle holds it once.

export const winkPosTagger = (): unknown => winkPosTaggerModule;

export const winkLexiconWords = (): unknown => winkLexicon;
