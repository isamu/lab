import { endingTokens } from "../sentence-shape.ts";
import type { LexiconEntry, OptionValue, Section, Sentence } from "../plugin.ts";
import { registerOf, type Register } from "./register.ts";

/** Where a sentence stands: the body text, a list (or a run of numbered paragraphs), or a heading. */
export type Region = "body" | "list" | "heading";

/** The register a team requires in each region, from chaff.yaml. A region left out is checked for consistency only. */
export type RequiredRegisters = Readonly<Partial<Record<Region, Register>>>;

const REGIONS: readonly Region[] = ["body", "list", "heading"];

/** The option values a team writes, and the register each names. `consistent` (the default) requires none. */
const BY_NAME: Readonly<Record<string, Register>> = { desumasu: "polite", dearu: "plain" };

/** Pure: the registers required by the rule's settings (`body: desumasu`, `list: dearu`), each only where written. */
export const requiredOf = (settings: Readonly<Record<string, OptionValue>> | undefined): RequiredRegisters =>
  Object.fromEntries(
    REGIONS.flatMap((region) => {
      const value = settings?.[region];
      const register = typeof value === "string" ? BY_NAME[value] : undefined;
      return register === undefined ? [] : [[region, register]];
    }),
  );

export const requiresAny = (required: RequiredRegisters): boolean => Object.keys(required).length > 0;

/** A sentence's region by the group it was counted in: no group is the body. */
export const regionOfGroup = (group: number | undefined): Region => (group === undefined ? "body" : "list");

type Judged = { readonly register: Register; readonly group: number | undefined; readonly quiet: boolean };

/** Pure: the judged sentences whose register is not the one their region requires. A quiet form is never one of them. */
export const offRequired = <T extends Judged>(judged: readonly T[], required: RequiredRegisters): T[] =>
  judged.filter((entry) => {
    const wanted = required[regionOfGroup(entry.group)];
    return wanted !== undefined && !entry.quiet && entry.register !== wanted;
  });

/** A heading read like a sentence, so its ending is judged the way a sentence's is. */
const headingSentence = (section: Section): Sentence => ({ span: section.span, text: section.heading, tokens: section.headingTokens ?? [] });

/** A heading and the register its ending has. Most headings end in a noun and have none. */
export type HeadingRead = { readonly section: Section; readonly register: Register };

/** Pure: the headings (not the part before the first one) whose ending has a register, and that register. */
export const headingRegisters = (sections: readonly Section[], polite: readonly LexiconEntry[], neutral: readonly LexiconEntry[]): HeadingRead[] =>
  sections.flatMap((section) => {
    if (section.depth === 0) return [];
    const sentence = headingSentence(section);
    const ending = endingTokens(sentence);
    const tokens = sentence.tokens ?? [];
    const head = ending[0] === undefined ? -1 : tokens.indexOf(ending[0]);
    const register = registerOf(ending, head > 0 ? tokens.slice(0, head) : [], polite, neutral);
    return register === undefined ? [] : [{ section, register }];
  });
