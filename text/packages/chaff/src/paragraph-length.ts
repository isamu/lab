/**
 * 段落が長すぎるか。文の数が上限を超え、しかも長さが「上限の数だけ普通の長さの文を並べた長さ」を超えるときだけ。
 * 短い文をいくつ並べても、読み手が息をつけない壁にはならない。長さは adapter の単位（日本語は文字、英語は語）。
 * fullSentence が無ければ、文の数だけで決める。
 */
export const isTooLongParagraph = (sentenceSizes: readonly number[], limit: number, fullSentence: number | undefined): boolean => {
  const size = sentenceSizes.reduce((sum, sentence) => sum + sentence, 0);
  return sentenceSizes.length > limit && (fullSentence === undefined || size > limit * fullSentence);
};
