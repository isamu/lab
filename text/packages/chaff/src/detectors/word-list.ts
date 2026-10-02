const separatorOf = (language: string): string => (language === "ja" ? "、" : ", ");

/** 語の並べ方は文書の言語に合わせる。日本語は「、」、ほかは ", "。英語の画面に「Risks、Costs」と出さない。 */
export const joinWords = (words: readonly string[], language: string): string => words.join(separatorOf(language));

/** joinWords で並べた語を、元の語に戻す。 */
export const splitWords = (joined: string, language: string): string[] => (joined === "" ? [] : joined.split(separatorOf(language)));
