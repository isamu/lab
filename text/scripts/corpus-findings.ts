import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter, ProseDocument, RuleDefinition } from "../packages/chaff/src/plugin.ts";
import { wordsOf } from "../packages/chaff/src/detectors/structure.ts";
import { judgedSentences } from "../packages/chaff/src/detectors/sentence-ending.ts";
import { lineNumberAt, linesOf } from "../packages/chaff/src/structure/lines.ts";
import type { RegisterCounts } from "./bench-text.ts";
import { buildDocument, teamRules } from "../packages/chaff/src/document.ts";
import { EMPTY } from "../packages/chaff/src/config/load.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules, runRulesWith, type RunResult } from "../packages/chaff/src/run.ts";
import { runCrossRules } from "../packages/chaff/src/cross-run.ts";
import { CROSS_DETECTORS } from "../packages/chaff/src/detectors/index.ts";
import { profileFor } from "../packages/chaff/src/profile/for-file.ts";
import { messageOf } from "../packages/chaff/src/render/text.ts";

export const STRUCTURE_RULES: readonly string[] = ["dangling-reference", "numbering-gap", "duplicate-definition"];

export type CorpusFinding = { readonly rule: string; readonly line: number; readonly message: string };

const ADAPTERS: Readonly<Record<string, LanguageAdapter>> = { ja, en };

/** What a team writes in chaff.yaml for the team rules: jargon, required_sections and prefer. */
export type TeamWords = {
  readonly jargon: readonly string[];
  readonly requiredSections: readonly string[];
  readonly prefer?: Readonly<Record<string, string>>;
};

const adapterOf = (language: string): LanguageAdapter => {
  const adapter = ADAPTERS[language];
  if (adapter === undefined) throw new Error(`no adapter for ${language}`);
  return adapter;
};

const documentOf = (path: string, source: string, language: string, genre: string, team: TeamWords): ProseDocument =>
  buildDocument(path, source, adapterOf(language), teamRules(team), profileFor(EMPTY, path, source, language, genre));

/** A document's length as chaff counts it for the rules with a length floor: its sentences, in the adapter's unit. */
export const documentLengthOf = (path: string, source: string, language: string, genre: string, team: TeamWords): number =>
  wordsOf(documentOf(path, source, language, genre, team));

/**
 * How many sentences no-mixed-desumasu reads as polite and as plain, among those it compares the sentence ending on
 * `line` with (its list, its numbered run, or the body). A sentence without a register (a noun, 「こと」) is in neither.
 */
export const registerCountsOf = (path: string, source: string, language: string, genre: string, team: TeamWords, line: number): RegisterCounts => {
  const doc = documentOf(path, source, language, genre, team);
  const wordList = loadRules(language).find((rule) => rule.id === "no-mixed-desumasu")?.word_list;
  const judged = judgedSentences(doc, wordList === undefined ? [] : (doc.lexicons[wordList] ?? []));
  const lines = linesOf(source);
  const onLine = judged.find((entry) => lineNumberAt(lines, entry.sentence.span.end - 1) === line);
  const peers = onLine === undefined ? [] : judged.filter((entry) => entry.group === onLine.group);
  return { polite: peers.filter((entry) => entry.register === "polite").length, plain: peers.filter((entry) => entry.register === "plain").length };
};

/** Every rule's run on one document of the given genre, as if --experimental, with the rules it ran. */
export const allRulesRun = async (
  path: string,
  source: string,
  language: string,
  genre: string,
  team: TeamWords = EMPTY,
  only: (id: string) => boolean = () => true,
): Promise<{ readonly result: RunResult; readonly rules: readonly RuleDefinition[] }> => {
  await adapterOf(language).prepare?.({ pos: true });
  const rules = loadRules(language).filter((rule) => only(rule.id));
  return {
    result: runRules(documentOf(path, source, language, genre, team), rules, {}, true, genre),
    rules,
  };
};

const findingsWith = async (
  path: string,
  source: string,
  language: string,
  only: (id: string) => boolean,
  genre: string,
  team: TeamWords = EMPTY,
): Promise<CorpusFinding[]> => {
  const { result, rules } = await allRulesRun(path, source, language, genre, team, only);
  const byId = new Map(rules.map((rule) => [rule.id, rule]));
  return result.findings.flatMap((finding) => {
    const rule = byId.get(finding.rule);
    return rule === undefined ? [] : [{ rule: finding.rule, line: finding.line, message: messageOf(rule, finding, language) }];
  });
};

/** The structure rules' findings on one statute, turned on as if --experimental, read as the legal/statute genre (its statute profile). */
export const structureFindings = async (path: string, source: string, language = "ja"): Promise<CorpusFinding[]> =>
  findingsWith(path, source, language, (id) => STRUCTURE_RULES.includes(id), "legal/statute");

/** Every rule's findings on one document of the given genre, as if --experimental, with the team's words when given. */
export const allFindings = async (path: string, source: string, language: string, genre: string, team?: TeamWords): Promise<CorpusFinding[]> =>
  findingsWith(path, source, language, () => true, genre, team);

/**
 * Every rule's findings on the files of one run of the given genre, as if --experimental: each file's own rules, then the
 * rules that compare the files (cross-run.ts). By path.
 */
export const runFindings = async (files: ReadonlyMap<string, string>, language: string, genre: string): Promise<Map<string, CorpusFinding[]>> => {
  await adapterOf(language).prepare?.({ pos: true });
  const rules = loadRules(language);
  const context = { settings: {}, experimental: true, genre };
  const inputs = [...files].map(([path, source]) => {
    const doc = documentOf(path, source, language, genre, EMPTY);
    return { doc, rules, context, raw: runRulesWith(doc, rules, context) };
  });
  const byId = new Map(rules.map((rule) => [rule.id, rule]));
  const results = runCrossRules(inputs, CROSS_DETECTORS);
  return new Map(
    inputs.map((input, index) => [
      input.doc.path,
      (results[index]?.findings ?? []).flatMap((finding) => {
        const rule = byId.get(finding.rule);
        return rule === undefined ? [] : [{ rule: finding.rule, line: finding.line, message: messageOf(rule, finding, language) }];
      }),
    ]),
  );
};

/** The manifest's language for each committed document, by file name. */
export const corpusLanguages = (manifest: unknown): ReadonlyMap<string, string> => {
  const documents = typeof manifest === "object" && manifest !== null && "documents" in manifest && Array.isArray(manifest.documents) ? manifest.documents : [];
  return new Map(
    documents.flatMap((entry: unknown) =>
      typeof entry === "object" && entry !== null && "id" in entry && "language" in entry && typeof entry.id === "string" && typeof entry.language === "string"
        ? [[`${entry.id}.txt`, entry.language] as const]
        : [],
    ),
  );
};
