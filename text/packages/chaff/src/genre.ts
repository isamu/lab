/** chaff が知っているジャンル。rule の use_for はこの頭の部分で当てる。 */
export const GENRES: readonly string[] = [
  "technical/spec",
  "technical/readme",
  "blog/tech",
  "blog/essay",
  "blog/owned-media",
  "business/proposal",
  "business/report",
  "business/email",
  "business/press-release",
  "business/meeting-notes",
];

export type GenreGuess = { readonly genre: string; readonly from: "front-matter" | "path" | "content" };

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
  if (front !== undefined) return { genre: front, from: "front-matter" };
  const byPath = BY_PATH.find(([pattern]) => pattern.test(path));
  if (byPath !== undefined) return { genre: byPath[1], from: "path" };
  const byContent = BY_CONTENT.find(([pattern]) => pattern.test(source));
  if (byContent !== undefined) return { genre: byContent[1], from: "content" };
  return undefined;
};

/** YAML の 1 行の値。行末のコメントと、値を囲む引用符を外す。 */
const scalarOf = (raw: string): string => {
  const comment = raw.search(/\s#/u);
  const value = (comment === -1 ? raw : raw.slice(0, comment)).trim();
  return /^(["'])(.*)\1$/u.exec(value)?.[2] ?? value;
};

const valuesOf = (block: string, key: string): string[] => [...block.matchAll(new RegExp(`^${key}:(.*)$`, "gmu"))].map((line) => scalarOf(line[1] ?? ""));

/** front matter の 1 つの欄に書かれた値。front matter が無ければ空。 */
export const frontMatterValues = (source: string, key: string): string[] => {
  const block = /^---\n([\s\S]*?)\n---/u.exec(source)?.[1];
  return block === undefined ? [] : valuesOf(block, key);
};

/**
 * front matter の genre / type を拾う。失敗しても落とさない。genre が type より先。
 * 知っているジャンルだけを返す。Zenn の type（tech / idea）のような別の意味の値をジャンルにすると、どの rule も当てはまらず「指摘なし」になる。
 */
export const frontMatterGenre = (source: string): string | undefined =>
  [...frontMatterValues(source, "genre"), ...frontMatterValues(source, "type")].find((value) => GENRES.includes(value));
