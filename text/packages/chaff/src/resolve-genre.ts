import { applyByPath } from "./config/by-path.ts";
import type { Config } from "./config/load.ts";
import type { GenreSource } from "./cli-text.ts";
import { frontMatterGenre, GENRES, guessGenre } from "./genre.ts";
import { unknownFrontMatterGenre } from "./genre-check.ts";
import { plainSource } from "./plain-source.ts";

/** unread: a genre the front matter wrote that chaff does not know, when the front matter was looked at. */
type ResolvedGenre = { readonly genre: string; readonly from: GenreSource; readonly unread?: string | undefined };

export const resolveGenre = (path: string, text: string, config: Config, cliGenre?: string): ResolvedGenre => {
  // コマンドで指定したものが最優先。その実行だけの指定だから、設定より強い。
  if (cliGenre !== undefined) return { genre: cliGenre, from: "--genre" };
  // パスごとの上書きが次。「全体はこう、ここだけは違う」を書けるようにする。
  const override = applyByPath(config.byPath, config.baseDir, path);
  if (override.genre !== undefined) return { genre: override.genre, from: "by_path" };
  if (config.genre !== undefined) return { genre: config.genre, from: "config" };
  // front matter と行頭の手がかりは、buildDocument と同じく BOM と CRLF / CR をそろえた本文で読む。
  const source = plainSource(text);
  const guess = guessGenre(path, source, frontMatterGenre(source));
  const unread = unknownFrontMatterGenre(source, GENRES);
  return guess === undefined ? { genre: "blog/tech", from: "default", unread } : { genre: guess.genre, from: guess.from, unread };
};
