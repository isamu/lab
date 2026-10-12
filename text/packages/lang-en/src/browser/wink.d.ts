// wink ships no types. The browser build imports these CommonJS modules and reads them as unknown.
declare module "wink-pos-tagger" {
  const factory: unknown;
  export default factory;
}

declare module "wink-lexicon/src/lexicon.js" {
  const words: unknown;
  export default words;
}

declare module "wink-lexicon/src/wn-words.js" {
  const words: unknown;
  export default words;
}

declare module "wink-lexicon/src/wn-word-senses.js" {
  const senses: unknown;
  export default senses;
}
