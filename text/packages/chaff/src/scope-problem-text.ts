import type { Texts, UiLanguage } from "./ui.ts";
import { TEXT_SCOPES, type ScopeProblem } from "./text-scope.ts";

// What is wrong with a scope written in chaff.yaml (custom_rules or prefer), as one sentence in the reader's language.

const NAMES = TEXT_SCOPES.join(" / ");

const TEXT: Texts<Readonly<Record<ScopeProblem["kind"], (written: string) => string>>> = {
  ja: {
    unknown: (written) => `scope の ${written} は知りません（${NAMES}。外すものは ~quote のように前に ~ を付けます）`,
    "not-a-list": (written) => `scope: ${written} は読めません。[heading] や [list, table]、[~quote] のように名前を並べてください`,
    empty: (written) => `scope: ${written} では読む所が残りません。選んだものをすべて ~ で外しています`,
  },
  en: {
    unknown: (written) => `unknown scope ${written} (${NAMES}; put ~ in front of one to leave it out, as in ~quote)`,
    "not-a-list": (written) => `cannot read scope: ${written}. Write a list of names, such as [heading], [list, table] or [~quote]`,
    empty: (written) => `scope: ${written} leaves nothing to read: every part it chooses is also left out with ~`,
  },
};

export const scopeProblemSentence = (kind: ScopeProblem["kind"], written: string, ui: UiLanguage): string => TEXT[ui][kind](written);
