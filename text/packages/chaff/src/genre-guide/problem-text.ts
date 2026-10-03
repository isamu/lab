import type { Texts, UiLanguage } from "../ui.ts";
import type { GuideProblem } from "./layer.ts";

type ProblemText = Readonly<{ [K in GuideProblem["kind"]]: (problem: Extract<GuideProblem, { kind: K }>) => string }>;

const TEXT: Texts<ProblemText> = {
  ja: {
    "not-a-map": (problem) => `guide の ${problem.written} は読めません。ジャンルか群の名前の下に replace・add・off を書くか、guide: off と書いてください`,
    "unknown-genre": (problem) => `guide の ${problem.genre} というジャンルや群はありません（npx chaffjs genres で一覧が出ます）`,
    "bad-entry": (problem) => `guide の ${problem.genre}: ${problem.written} は読めません。replace か add に行を書くか、off と書いてください`,
    "bad-lines": (problem) => `guide の ${problem.genre}: ${problem.field} は 1 行か行の並びで、言語ごとなら ja: と en: の下に書いてください`,
  },
  en: {
    "not-a-map": (problem) => `guide ${problem.written} cannot be read; write replace, add or off under a genre or group, or guide: off`,
    "unknown-genre": (problem) => `guide names ${problem.genre}, which is no genre or group (npx chaffjs genres lists them)`,
    "bad-entry": (problem) => `guide ${problem.genre}: ${problem.written} cannot be read; write lines under replace or add, or off`,
    "bad-lines": (problem) => `guide ${problem.genre}: write ${problem.field} as a line or a list of lines, under ja: and en: for each language`,
  },
};

/** One guide problem as a sentence, without the place it was written (the caller names chaff.yaml, a style or a plugin). */
export const guideProblemText = (problem: GuideProblem, ui: UiLanguage): string => {
  const text = TEXT[ui];
  switch (problem.kind) {
    case "not-a-map":
      return text["not-a-map"](problem);
    case "unknown-genre":
      return text["unknown-genre"](problem);
    case "bad-entry":
      return text["bad-entry"](problem);
    case "bad-lines":
      return text["bad-lines"](problem);
  }
};
