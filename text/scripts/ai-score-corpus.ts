// `yarn ai-score:corpus`: the AI-likeness quick score's levels on human documents and on generated-style samples, by pile:
//   corpus   the committed human documents (corpus/docs) and the statutes (corpus/laws); --all adds the fetched corpus/.cache
//   paired   test/fixtures/ai-samples/paired/<lang>/<kind>/{ai,human,rewritten}.md, the generated style and its human pair
//   samples  test/fixtures/ai-samples/<lang>/*.md and test/fixtures/ai-score/*.md, written in the generated style or plainly
// Human documents should read low; --verbose lists each document with its level and the signs it showed.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { buildDocument, teamRules } from "../packages/chaff/src/document.ts";
import { EMPTY } from "../packages/chaff/src/config/load.ts";
import { profileFor } from "../packages/chaff/src/profile/for-file.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";
import { aiScoreOfDocument } from "../packages/chaff/src/ai-score/of-document.ts";
import type { AiScore } from "../packages/chaff/src/ai-score/score.ts";
import { docEntries, docPath, parsedAs } from "./corpus-docs.ts";
import { corpusLanguages } from "./corpus-findings.ts";

const ROOT = join(import.meta.dirname, "..");
const CORPUS = join(ROOT, "corpus");
const AI_SAMPLES = join(ROOT, "test", "fixtures", "ai-samples");
const SCORE_SAMPLES = join(ROOT, "test", "fixtures", "ai-score");
const STATUTE_GENRE = "legal/statute";
const LANGUAGES: readonly string[] = ["ja", "en"];
/** The genre each kind of paired sample is read as, as `yarn bench:ai` reads it. */
const KIND_GENRES: Readonly<Record<string, string>> = { tech: "blog/tech", business: "business/report", essay: "blog/essay" };
/** The genre each single sample is read as. */
const SAMPLE_GENRES: Readonly<Record<string, string>> = { article: "blog/tech", blog: "blog/essay", email: "business/email" };
const ADAPTERS: Readonly<Record<string, LanguageAdapter>> = { ja, en };

type Input = { readonly pile: string; readonly id: string; readonly file: string; readonly readAs: string; readonly language: string; readonly genre: string };

const manifest: unknown = JSON.parse(readFileSync(join(CORPUS, "manifest.json"), "utf8"));

const corpusInputs = (withCache: boolean): Input[] => {
  const languages = corpusLanguages(manifest);
  const laws = readdirSync(join(CORPUS, "laws"))
    .filter((file) => file.endsWith(".txt"))
    .map((file) => ({ pile: "corpus", id: file, file: join(CORPUS, "laws", file), readAs: file, language: languages.get(file) ?? "ja", genre: STATUTE_GENRE }));
  const docs = docEntries(manifest)
    .filter((entry) => entry.redistribute || withCache)
    .map((entry) => ({
      pile: entry.redistribute ? "corpus" : "corpus (fetched)",
      id: entry.id,
      file: docPath(CORPUS, entry),
      readAs: parsedAs(entry),
      language: entry.language,
      genre: entry.genre,
    }));
  return [...laws, ...docs].filter((input) => existsSync(input.file));
};

const pairedInputs = (): Input[] =>
  LANGUAGES.flatMap((language) =>
    Object.entries(KIND_GENRES).flatMap(([kind, genre]) =>
      ["ai", "human", "rewritten"].map((variant) => {
        const file = join(AI_SAMPLES, "paired", language, kind, `${variant}.md`);
        return { pile: `paired ${variant}`, id: `${language}/${kind}/${variant}`, file, readAs: file, language, genre };
      }),
    ),
  );

const sampleInputs = (): Input[] => [
  ...LANGUAGES.flatMap((language) =>
    Object.entries(SAMPLE_GENRES).map(([name, genre]) => {
      const file = join(AI_SAMPLES, language, `${name}.md`);
      return { pile: "samples ai", id: `${language}/${name}`, file, readAs: file, language, genre };
    }),
  ),
  ...readdirSync(SCORE_SAMPLES)
    .filter((file) => file.endsWith(".md"))
    .toSorted((left, right) => left.localeCompare(right, "en"))
    .map((file) => {
      const [language = "ja", style = "ai"] = file.replace(/\.md$/u, "").split("-");
      return { pile: `samples ${style}`, id: file, file: join(SCORE_SAMPLES, file), readAs: file, language, genre: "blog/tech" };
    }),
];

const scoreOf = (input: Input): AiScore => {
  const adapter = ADAPTERS[input.language];
  if (adapter === undefined) throw new Error(`${input.file}: no adapter for ${input.language}`);
  const source = readFileSync(input.file, "utf8");
  const doc = buildDocument(input.readAs, source, adapter, teamRules(EMPTY), profileFor(EMPTY, input.readAs, source, input.language, input.genre));
  return aiScoreOfDocument(doc, loadRules(input.language), input.genre);
};

const outcomeOf = (score: AiScore): string => score.level ?? `not scored (${score.notScored?.reason ?? ""})`;

const signsOf = (score: AiScore): string[] => [
  ...score.signals.filter((signal) => signal.unusual).map((signal) => signal.rule),
  ...(score.structure ?? []).filter((place) => place.beyond && place.sameAs === undefined).map((place) => `structure:${place.feature.id}`),
];

await ja.prepare?.({ pos: true });
await en.prepare?.({ pos: true });
const inputs = [...corpusInputs(process.argv.includes("--all")), ...pairedInputs(), ...sampleInputs()];
const scored = inputs.map((input) => ({ input, score: scoreOf(input) }));
if (process.argv.includes("--verbose")) {
  scored.forEach(({ input, score }) =>
    console.log(
      `${input.pile}  ${input.id}  ${input.genre}  ${outcomeOf(score)}  ${String(score.signs)}/${String(score.compared)}  ${signsOf(score).join(" ")}`,
    ),
  );
}
const tally = scored.reduce<Map<string, Map<string, number>>>((piles, { input, score }) => {
  const outcomes = piles.get(input.pile) ?? new Map<string, number>();
  outcomes.set(outcomeOf(score), (outcomes.get(outcomeOf(score)) ?? 0) + 1);
  return piles.set(input.pile, outcomes);
}, new Map());
tally.forEach((outcomes, pile) =>
  console.log(
    `${pile}: ${[...outcomes.entries()]
      .toSorted(([left], [right]) => left.localeCompare(right, "en"))
      .map(([outcome, count]) => `${outcome} ${String(count)}`)
      .join(", ")}`,
  ),
);
