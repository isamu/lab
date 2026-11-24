import type { Config } from "./load.ts";
import type { Texts, UiLanguage } from "../ui.ts";

type ConsistentTexts = {
  readonly unreadable: (where: string, value: string) => string;
  readonly twice: (where: string, member: string) => string;
};

const TEXT: Texts<ConsistentTexts> = {
  ja: {
    unreadable: (where, value) =>
      `${where}: consistent の ${value} は組として読めません。consistent には、まぜない語の組を、違う語 2 つ以上の並びで 1 行に 1 つずつ書いてください（- [顧客, お客様]）`,
    twice: (where, member) =>
      `${where}: consistent で「${member}」が二つの組に入っています。どちらの組の語と比べるか決まらないので、一つの組にまとめてください`,
  },
  en: {
    unreadable: (where, value) =>
      `${where}: cannot read ${value} under consistent as a group. Write each group as a list of two or more different words, one group per line (- [log in, sign in])`,
    twice: (where, member) => `${where}: "${member}" is in two groups under consistent. It cannot be told which to compare it with; put them in one group`,
  },
};

/** Members listed in more than one group, each once, in the order they first repeat. */
const repeatedMembers = (groups: readonly (readonly string[])[]): string[] => {
  const members = groups.flatMap((group) => [...new Set(group)]);
  return [...new Set(members.filter((member, at) => members.indexOf(member) !== at))];
};

/** What under consistent in chaff.yaml has no effect or no clear effect: values not read as groups, and words in two groups. */
export const consistentProblems = (config: Pick<Config, "consistent" | "unreadableConsistent" | "path">, ui: UiLanguage = "ja"): string[] => {
  const where = config.path ?? "chaff.yaml";
  return [
    ...(config.unreadableConsistent ?? []).map((value) => TEXT[ui].unreadable(where, value)),
    ...repeatedMembers(config.consistent ?? []).map((member) => TEXT[ui].twice(where, member)),
  ];
};
