// The two kuromoji modules the browser build assembles a tokenizer from (kuromoji's TokenizerBuilder does the same).
declare module "@sglkc/kuromoji/src/Tokenizer.js" {
  export default class Tokenizer {
    constructor(dictionaries: unknown);
  }
}

declare module "@sglkc/kuromoji/src/loader/DictionaryLoader.js" {
  export default class DictionaryLoader {
    constructor(dicPath: string);
    loadArrayBuffer: (url: string, loaded: (error: unknown, buffer: ArrayBuffer | null) => void) => void;
    load(done: (error: unknown, dictionaries: unknown) => void): void;
  }
}
