import type { GenreData } from "./genre-parse.ts";
import type { Texts, UiLanguage } from "./ui.ts";

/** The genre init writes when nothing is chosen: the one a check uses when none is set. */
export const DEFAULT_GENRE = "blog/tech";

const TEXT: Texts<{ readonly heading: string; readonly prompt: string; readonly notAGenre: (answer: string) => string; readonly noAnswer: string }> = {
  ja: {
    heading: "どの種類の文書をここに置きますか？ 選んだ種類の書き方に合わせて見ます。",
    prompt: `番号か名前を入れてください（Enter で ${DEFAULT_GENRE}）: `,
    notAGenre: (answer) => `「${answer}」は一覧にありません。何も作っていません。npx chaffjs init --genre <ジャンル> でも選べます。`,
    noAnswer: "答えが無いまま入力が終わったので、何も作っていません。",
  },
  en: {
    heading: "What kind of document goes here? chaff checks it the way that kind is written.",
    prompt: `Type a number or a name (Enter for ${DEFAULT_GENRE}): `,
    notAGenre: (answer) => `"${answer}" is not in the list. Nothing was created. npx chaffjs init --genre <genre> chooses one too.`,
    noAnswer: "The input ended without an answer, so nothing was created.",
  },
};

/** The numbered list init shows before it asks: every genre with what it is for, in genres.yaml's order. */
export const genreChoices = (data: GenreData, ui: UiLanguage): string[] => {
  const width = Math.max(...data.genres.map((genre) => genre.id.length)) + 2;
  const numberWidth = String(data.genres.length).length;
  return [
    "",
    TEXT[ui].heading,
    "",
    ...data.genres.map((genre, index) => `  ${String(index + 1).padStart(numberWidth)}  ${genre.id.padEnd(width)}${genre.summary[ui] ?? ""}`),
    "",
  ];
};

export const choicePrompt = (ui: UiLanguage): string => TEXT[ui].prompt;

export const notAGenre = (answer: string, ui: UiLanguage): string => TEXT[ui].notAGenre(answer);

export const noAnswer = (ui: UiLanguage): string => TEXT[ui].noAnswer;

/** A number from the list, a genre's name, or nothing (the default). undefined for anything else: init then writes nothing. */
export const genreFromAnswer = (answer: string, ids: readonly string[]): string | undefined => {
  const typed = answer.trim();
  if (typed === "") return DEFAULT_GENRE;
  if (ids.includes(typed)) return typed;
  return /^\d+$/u.test(typed) ? ids[Number(typed) - 1] : undefined;
};
