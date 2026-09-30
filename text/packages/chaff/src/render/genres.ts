import type { GenreData } from "../genre-parse.ts";
import type { Texts, UiLanguage } from "../ui.ts";

const TEXT: Texts<{ readonly heading: string; readonly usage: readonly string[] }> = {
  ja: {
    heading: "  ジャンル（文書の種類）を選ぶと、その種類の書き方に合わせて見ます:",
    usage: [
      "  この実行だけ:    npx chaffjs --genre legal/contract 契約書.md",
      "  この場所に決める: npx chaffjs init --genre legal/contract   （chaff.yaml の genre に書きます）",
    ],
  },
  en: {
    heading: "  Pick the genre (the kind of document) and chaff checks it the way that kind is written:",
    usage: [
      "  For one run:       npx chaffjs --genre legal/contract contract.md",
      "  For this folder:   npx chaffjs init --genre legal/contract   (writes genre in chaff.yaml)",
    ],
  },
};

/** `chaff genres`: every genre under its group, with what it is for, in the output language. */
export const renderGenres = (data: GenreData, ui: UiLanguage): string => {
  const width = Math.max(...data.genres.map((genre) => genre.id.length)) + 2;
  const groups = data.groups.flatMap((group) => {
    const members = data.genres.filter((genre) => genre.id.startsWith(`${group.id}/`));
    return members.length === 0
      ? []
      : ["", `  ${group.name[ui] ?? group.id}`, ...members.map((genre) => `    ${genre.id.padEnd(width)}${genre.summary[ui] ?? ""}`)];
  });
  return ["", TEXT[ui].heading, ...groups, "", ...TEXT[ui].usage, ""].join("\n");
};
