import type { Texts } from "../ui.ts";
import { counted } from "../render/plural.ts";
import { COMPARE_TEXT, type CompareText } from "./text.ts";

/** What `chaff facts` says. The names of the kinds and the reasons a kind was not read are compare's own. */
export type FactsText = Pick<CompareText, "kinds" | "unread" | "unreadHeading" | "separator"> & {
  readonly usage: string;
  /** The first line: the file, how many facts, and the count per kind. */
  readonly title: (path: string, total: number, perKind: string) => string;
  readonly kindHeading: (kindName: string, count: number) => string;
  /** How a kind is counted in the first line (数 12 / numbers 12). */
  readonly kindCount: (kindName: string, count: number) => string;
  /** The last line: the command that checks a rewrite against this list. */
  readonly next: (path: string) => string;
};

const shared = (text: CompareText): Pick<CompareText, "kinds" | "unread" | "unreadHeading" | "separator"> => ({
  kinds: text.kinds,
  unread: text.unread,
  unreadHeading: text.unreadHeading,
  separator: text.separator,
});

export const FACTS_TEXT: Texts<FactsText> = {
  ja: {
    ...shared(COMPARE_TEXT.ja),
    usage: "使い方: chaff facts <file> [--compact | --json] [--language ja|en|…] [--genre <ジャンル>]",
    title: (path, total, perKind) => `${path} の事実 ${String(total)} 件（${perKind}）`,
    kindHeading: (kindName, count) => `${kindName} ${String(count)} 件`,
    kindCount: (kindName, count) => `${kindName} ${String(count)}`,
    next: (path) => `書き直したら npx chaffjs compare ${path} <書き直した後> で、この一覧が残っているかを確かめます`,
  },
  en: {
    ...shared(COMPARE_TEXT.en),
    usage: "usage: chaff facts <file> [--compact | --json] [--language ja|en|…] [--genre <genre>]",
    title: (path, total, perKind) => `${path}: ${counted(total, "fact")} (${perKind})`,
    kindHeading: (kindName, count) => `${kindName}: ${String(count)}`,
    kindCount: (kindName, count) => `${kindName} ${String(count)}`,
    next: (path) => `After rewriting, npx chaffjs compare ${path} <rewritten> checks that every fact on this list is still there`,
  },
};
