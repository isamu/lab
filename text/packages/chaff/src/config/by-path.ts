import { relative, sep } from "node:path";

export type PathRule = { readonly files: readonly string[]; readonly genre: string | undefined; readonly language: string | undefined };

/**
 * glob を正規表現にする。使うのは 3 つだけ。
 *   **\/  区切りをまたいでディレクトリ 0 個以上（docs/**\/*.md は docs/a.md にも当たる）
 *   *    区切りをまたがずに何文字でも
 *   ?    区切り以外の 1 文字
 * これ以上を足すと、設定を書く人が覚えることが増える。
 *
 * 「ディレクトリ 0 個」を落とすと docs/**\/*.md が docs/a.md に当たらない。
 * glob の典型的な落とし穴で、設定を書いた人は当たらない理由に気づけない。
 */
const DIRS = "\u0000";
const ANY = "\u0001";

const toPattern = (glob: string): RegExp => {
  const body = glob
    .replace(/[.+^${}()|[\]\\]/gu, "\\$&")
    .replace(/\*\*\//gu, DIRS)
    .replace(/\*\*/gu, ANY)
    .replace(/\*/gu, "[^/]*")
    .replace(/\?/gu, "[^/]")
    .replaceAll(DIRS, "(?:[^/]*/)*")
    .replaceAll(ANY, ".*");
  return new RegExp(`^${body}$`, "u");
};

/** 設定ファイルからの相対で照合する。実行した場所に左右されないため。 */
const normalize = (base: string, path: string): string => relative(base, path).split(sep).join("/");

export const matches = (glob: string, base: string, path: string): boolean => toPattern(glob).test(normalize(base, path));

/**
 * 後に書いたものが勝つ。上から順に当て、最後に当たったものを使う。
 * 「全体はこう、ここだけは違う」と書けるようにするため。
 */
export const applyByPath = (rules: readonly PathRule[], base: string, path: string): { genre?: string; language?: string } =>
  rules.reduce<{ genre?: string; language?: string }>((acc, rule) => {
    if (!rule.files.some((glob) => matches(glob, base, path))) return acc;
    return {
      ...acc,
      ...(rule.genre === undefined ? {} : { genre: rule.genre }),
      ...(rule.language === undefined ? {} : { language: rule.language }),
    };
  }, {});
