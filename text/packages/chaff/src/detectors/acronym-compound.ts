/** - で繋いだ略語（RT-PCR）の部品。繋いでいなければ、その語だけ。 */
export const partsOf = (acronym: string): string[] => acronym.split("-");

/**
 * 略語が説明済みか。- で繋いだ語は、繋いだ形のまま説明されているか、部品がどれも説明済みなら説明済み。
 * US-EU は US も EU も通じるので指摘しない。RT-PCR は RT がどこにも説明されていないので、繋いだ形で指摘する。
 */
export const isExplained = (acronym: string, explainedAlone: (word: string) => boolean): boolean =>
  explainedAlone(acronym) || partsOf(acronym).every(explainedAlone);
