import winkPosTaggerModule from "wink-pos-tagger";
import winkLexicon from "wink-lexicon/src/lexicon.js";
import winkWordNetWords from "wink-lexicon/src/wn-words.js";
import winkWordNetSenses from "wink-lexicon/src/wn-word-senses.js";

// wink-modules.ts in a bundle: the tagger and its vocabulary bundled. The vocabulary and WordNet are the modules the
// tagger itself imports, so the bundle holds them once.

export const winkPosTagger = (): unknown => winkPosTaggerModule;

export const winkLexiconWords = (): unknown => winkLexicon;

export const winkWordNet = (): { readonly words: unknown; readonly senses: unknown } => ({ words: winkWordNetWords, senses: winkWordNetSenses });
