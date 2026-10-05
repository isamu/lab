import Tokenizer from "@sglkc/kuromoji/src/Tokenizer.js";
import DictionaryLoader from "@sglkc/kuromoji/src/loader/DictionaryLoader.js";
import { kuromojiDictionaryUrl } from "chaffjs/browser-files";
import { dictionaryBytes } from "./dictionary-bytes.ts";

// kuromoji-module.ts in a bundle: kuromoji's builder, with its dictionary fetched from where the page serves it the
// first time a Japanese text is checked. kuromoji's own browser loader is not used: it gunzips every file, and fails
// when the server already sent a file unpacked.

type BuildDone = (error: unknown, tokenizer: unknown) => void;

/** kuromoji joins the folder and the file name by collapsing every run of slashes, https:// included: keep only the name. */
export const dictionaryFileUrl = (joined: string, dicPath: string): string => new URL(joined.slice(joined.lastIndexOf("/") + 1), dicPath).href;

const build = (dicPath: string, done: BuildDone): void => {
  const loader = new DictionaryLoader(dicPath);
  loader.loadArrayBuffer = (url, loaded) => {
    dictionaryBytes(dictionaryFileUrl(url, dicPath)).then(
      (buffer) => loaded(null, buffer),
      (error: unknown) => loaded(error, null),
    );
  };
  loader.load((error, dictionaries) => done(error, new Tokenizer(dictionaries)));
};

/** The part of kuromoji pos.ts calls: builder({ dicPath }).build(done). */
export const kuromojiModule = (): unknown => ({
  builder: (option: { readonly dicPath: string }) => ({ build: (done: BuildDone) => build(option.dicPath, done) }),
});

export const kuromojiDictionaryPath = (): string => kuromojiDictionaryUrl();
