import type { Config } from "./load.ts";
import type { Texts, UiLanguage } from "../ui.ts";
import { foldTerm } from "../term-form.ts";

type TermTexts = {
  readonly unreadable: (where: string, value: string) => string;
  readonly clash: (where: string, first: string, second: string) => string;
};

const TEXT: Texts<TermTexts> = {
  ja: {
    unreadable: (where, value) => `${where}: terms の ${value} は語として読めません。terms には決まった書き方の語を 1 行に 1 つずつ並べてください（- GitHub）`,
    clash: (where, first, second) =>
      `${where}: terms の「${first}」と「${second}」は字の大小・幅・ハイフン・空白だけが違います。どちらも正しい書き方として扱うので、互いを指摘しません。決まった書き方を 1 つにしてください`,
  },
  en: {
    unreadable: (where, value) =>
      `${where}: cannot read ${value} under terms as a term. Write terms as a list, one term per line, as it must be written (- GitHub)`,
    clash: (where, first, second) =>
      `${where}: "${first}" and "${second}" under terms differ only in case, width, hyphens or spaces. Both are taken as right, so neither is reported; keep the one the team writes`,
  },
};

/** Listed terms that fold to the same one, as the first written and each other spelling. */
const clashesOf = (terms: readonly string[]): { readonly first: string; readonly second: string }[] =>
  terms.flatMap((term, at) => {
    const first = terms.slice(0, at).find((earlier) => foldTerm(earlier) === foldTerm(term) && earlier !== term);
    return first === undefined || terms.slice(0, at).includes(term) ? [] : [{ first, second: term }];
  });

/** What under terms in chaff.yaml has no effect: values not read as terms, and terms that differ only in what term-form sets aside. */
export const termProblems = (config: Pick<Config, "terms" | "unreadableTerms" | "path">, ui: UiLanguage = "ja"): string[] => {
  const where = config.path ?? "chaff.yaml";
  return [
    ...(config.unreadableTerms ?? []).map((value) => TEXT[ui].unreadable(where, value)),
    ...clashesOf(config.terms ?? []).map(({ first, second }) => TEXT[ui].clash(where, first, second)),
  ];
};
