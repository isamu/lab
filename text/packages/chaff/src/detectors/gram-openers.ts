import type { Section, Sentence } from "../plugin.ts";

/**
 * 見出しのある節の最初の文。参照用の文書は、節ごとに同じ書き出し（「…によると以下の制約である。」）で始める。
 * 言い回しがどれも節の最初の文にだけ出るなら、節のひな形で、書き手が言い直したのではない。導入部（見出しの前）は節ではない。
 */
export const sectionOpeners = (sections: readonly Pick<Section, "depth" | "sentences">[]): Set<Sentence> =>
  new Set(sections.flatMap((section) => (section.depth > 0 && section.sentences[0] !== undefined ? [section.sentences[0]] : [])));
