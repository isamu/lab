export type GenreGuess = { readonly genre: string; readonly from: string };

/**
 * 仕様書・README は「読ませる文章」ではなく「間違えさせない文章」。
 * 書き出しのつかみもリズムも要らない。技術文書として別に見る。
 */
const BY_PATH: readonly (readonly [RegExp, string])[] = [
  [/(^|\/)readme\.md$/iu, "technical/readme"],
  [/spec[^/]*\.md$/iu, "technical/spec"],
  [/(^|\/)(spec|specs)\//iu, "technical/spec"],
  [/(^|\/)(proposals?|teian)\//iu, "business/proposal"],
  [/(^|\/)(minutes|gijiroku)\//iu, "business/meeting-notes"],
  [/(^|\/)(press|pr)\//iu, "business/press-release"],
  [/(^|\/)(reports?)\//iu, "business/report"],
  [/(^|\/)(blog|posts?|articles?)\//iu, "blog/tech"],
  [/(^|\/)docs?\//iu, "technical/readme"],
];

/**
 * 見出しと行頭に限る。本文中の言及では判定しない。
 * 「決定事項」という語を説明している文書を議事録と判定してしまうため。
 */
const BY_CONTENT: readonly (readonly [RegExp, string])[] = [
  [/^#{1,6}\s.*(?:報道関係者各位|For Immediate Release)/mu, "business/press-release"],
  [/^(?:#{1,6}\s)?(?:出席者|決定事項|Attendees)\s*$/mu, "business/meeting-notes"],
  [/^(?:拝啓|お世話になっております)/mu, "business/report"],
];

export const guessGenre = (path: string, source: string, front: string | undefined): GenreGuess | undefined => {
  if (front !== undefined) return { genre: front, from: "front matter" };
  const byPath = BY_PATH.find(([pattern]) => pattern.test(path));
  if (byPath !== undefined) return { genre: byPath[1], from: "パス" };
  const byContent = BY_CONTENT.find(([pattern]) => pattern.test(source));
  if (byContent !== undefined) return { genre: byContent[1], from: "内容" };
  return undefined;
};

/** front matter の genre / type を拾う。失敗しても落とさない。 */
export const frontMatterGenre = (source: string): string | undefined => {
  const match = /^---\n([\s\S]*?)\n---/u.exec(source);
  const line = match?.[1] === undefined ? undefined : /^(?:genre|type):\s*(\S+)\s*$/mu.exec(match[1]);
  return line?.[1];
};
