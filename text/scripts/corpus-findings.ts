import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";
import { buildDocument, teamRules } from "../packages/chaff/src/document.ts";
import { EMPTY } from "../packages/chaff/src/config/load.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
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

const findingsWith = async (
  path: string,
  source: string,
  language: string,
  only: (id: string) => boolean,
  genre: string,
  team: TeamWords = EMPTY,
): Promise<CorpusFinding[]> => {
  const adapter = ADAPTERS[language];
  if (adapter === undefined) throw new Error(`no adapter for ${language}`);
  await adapter.prepare?.({ pos: true });
  const rules = loadRules(language).filter((rule) => only(rule.id));
  const result = runRules(buildDocument(path, source, adapter, teamRules(team), profileFor(EMPTY, path, source, language, genre)), rules, {}, true, genre);
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
