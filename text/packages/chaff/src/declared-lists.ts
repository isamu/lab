import type { Lexicon, RuleDefinition } from "./plugin.ts";

/** rule が宣言した語彙表のうち、その言語に無い最初のもの。無いまま動かすと、照らす語が無いだけの 0 件や指摘が本物に見える。 */
export const missingList = (rule: RuleDefinition, lexicons: Readonly<Record<string, Lexicon>>): string | undefined =>
  [...(rule.word_list === undefined ? [] : [rule.word_list]), ...rule.extra_word_lists].find((name) => lexicons[name] === undefined);
