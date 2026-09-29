import type { Lexicon } from "chaffjs/plugin";

/** 解析器が返す 1 語。pos は Penn Treebank。 */
type TaggedWord = { readonly value: string; readonly pos: string };

/** 状態を表す過去分詞の句（語の並び）と、程度の副詞。どちらも語彙表から引く。 */
export type StativeVocabulary = {
  readonly phrases: readonly (readonly string[])[];
  readonly degreeAdverbs: ReadonlySet<string>;
};

const wordsOf = (lexicon: Lexicon | undefined): string[][] =>
  (lexicon ?? [])
    .map((entry) =>
      entry.pattern
        .toLowerCase()
        .split(" ")
        .filter((word) => word !== ""),
    )
    .filter((words) => words.length > 0);

export const stativeVocabulary = (lexicons: Readonly<Record<string, Lexicon>>): StativeVocabulary => ({
  phrases: wordsOf(lexicons["stative-participle"]),
  degreeAdverbs: new Set(wordsOf(lexicons["degree-adverb"]).flat()),
});

const wordAt = (tagged: readonly TaggedWord[], at: number): string | undefined => tagged[at]?.value.toLowerCase();

const startsPhrase = (tagged: readonly TaggedWord[], at: number, phrase: readonly string[]): boolean =>
  phrase.every((word, offset) => wordAt(tagged, at + offset) === word);

/** very は段階のある形容詞にしか付かない。very surprised は言えても very approved は言えない。 */
const afterDegreeAdverb = (tagged: readonly TaggedWord[], at: number, vocabulary: StativeVocabulary): boolean => {
  const before = wordAt(tagged, at - 1);
  return before !== undefined && vocabulary.degreeAdverbs.has(before);
};

/**
 * be の後の過去分詞が、誰かのした動作ではなく状態を表しているか。
 * We are delighted to offer / is based on / are entitled to には名指すべき動作主がいない。
 */
export const isStativeParticiple = (tagged: readonly TaggedWord[], at: number, vocabulary: StativeVocabulary): boolean =>
  vocabulary.phrases.some((phrase) => startsPhrase(tagged, at, phrase)) || afterDegreeAdverb(tagged, at, vocabulary);
