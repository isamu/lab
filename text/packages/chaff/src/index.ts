export type { AdapterCapabilities, LanguageAdapter, LengthUnit, Segmentation, Sentence, Span, Token } from "./plugin.ts";
export type { LanguageGuess } from "./detect.ts";
export { guessLanguage } from "./detect.ts";
export { loadAdapter, packageFor } from "./adapter-load.ts";
