import { readFile } from "node:fs/promises";
import { loadAdapter, packageFor } from "./adapter-load.ts";
import { guessLanguage } from "./detect.ts";
import type { Sentence } from "./plugin.ts";

const USAGE = `chaff — prose validation harness

  chaff <file>    文章を読み、言語を判定して文に分ける

まだ rule は 1 つも実装されていません。いまは言語判定と文分割だけが動きます。
仕様: text/chaff-spec.md / text/chaff-workflow-spec.md
`;

const lengths = (sentences: readonly Sentence[]): number[] => sentences.map((sentence) => sentence.text.trim().length);

const longest = (sentences: readonly Sentence[]): Sentence | undefined =>
  sentences.reduce<Sentence | undefined>((best, sentence) => (best === undefined || sentence.text.length > best.text.length ? sentence : best), undefined);

const report = (path: string, language: string, confidence: number, sentences: readonly Sentence[]): string[] => {
  const sizes = lengths(sentences);
  const total = sizes.reduce((sum, size) => sum + size, 0);
  const lines = [
    "",
    `${path}   ${language === "ja" ? "日本語" : "英語"}   本文から推定 (${confidence.toFixed(2)})`,
    "",
    `  ${sentences.length} 文 / 平均 ${sentences.length === 0 ? 0 : Math.round(total / sentences.length)} 文字`,
  ];
  const worst = longest(sentences);
  if (worst !== undefined) lines.push(`  いちばん長い文: ${worst.text.trim().length} 文字  (${worst.span.start} 文字目から)`);
  lines.push("", "  まだ rule は実装されていません。文章は書き換えていません。", "");
  return lines;
};

export const main = async (argv: readonly string[]): Promise<number> => {
  const path = argv[0];
  if (path === undefined || path === "--help" || path === "-h") {
    console.log(USAGE);
    return path === undefined ? 1 : 0;
  }
  const source = await readFile(path, "utf8");
  const guess = guessLanguage(source);
  if (packageFor(guess.language) === undefined) {
    console.error(`言語 "${guess.language}" のアダプタがありません。`);
    return 1;
  }
  const adapter = await loadAdapter(guess.language);
  const { sentences } = adapter.segment(source);
  console.log(report(path, guess.language, guess.confidence, sentences).join("\n"));
  return 0;
};
