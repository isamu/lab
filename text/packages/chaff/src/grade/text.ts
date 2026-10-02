import type { Texts } from "../ui.ts";
import { ATOM_KINDS } from "../compare/atom.ts";
import type { ItemProblem, ItemProblemKind } from "./item.ts";
import type { Expected, RubricProblem } from "./rubric.ts";

export type GradeText = {
  readonly usage: string;
  readonly noReference: string;
  readonly noCitations: string;
  readonly unknownRule: string;
  readonly rubricProblem: (problem: RubricProblem) => string;
  readonly penalty: (total: number) => string;
  readonly noStructure: (source: string, language: string) => string;
  readonly unreadable: (path: string, why: string) => string;
  readonly problem: (problem: ItemProblem) => string;
  readonly cannotLoad: (why: string) => string;
  readonly wrote: (path: string, count: number) => string;
  readonly totals: (path: string, total: number, passed: number) => string;
  readonly failedHeading: string;
  readonly ratesHeading: (unit: string) => string;
  readonly unit: Readonly<Record<"char" | "word", string>>;
  readonly outputsWith: (count: number) => string;
  readonly facts: (dropped: number, added: number, droppedKinds: string, addedKinds: string) => string;
  readonly citations: (checked: number, failed: number) => string;
  readonly notRunHeading: (count: number) => string;
  readonly inOutputs: (count: number) => string;
  readonly stamp: string;
};

const PROBLEM_JA: Readonly<Record<ItemProblemKind, (problem: ItemProblem) => string>> = {
  "not-json": (problem) => `${String(problem.line)} 行目: JSON として読めません（${problem.detail ?? ""}）`,
  "not-object": (problem) => `${String(problem.line)} 行目: 1 行に 1 つのオブジェクト {…} を書いてください`,
  "no-id": (problem) => `${String(problem.line)} 行目: id（空でない文字列）がありません`,
  "no-output": (problem) => `${String(problem.line)} 行目: output（文字列）がありません`,
  "not-string": (problem) => `${String(problem.line)} 行目: ${problem.detail ?? ""} は文字列で書いてください`,
  "not-text-map": (problem) => `${String(problem.line)} 行目: ${problem.detail ?? ""} は { "名前": "本文" } の形で書いてください`,
  "not-citations": (problem) => `${String(problem.line)} 行目: citations は [{ "source", "address", "quote" }] の配列で書いてください`,
  "citations-without-sources": (problem) =>
    `${String(problem.line)} 行目: citations があるのに sources がありません。引用を照らす原文を sources に入れてください`,
  "duplicate-id": (problem) => `${String(problem.line)} 行目: id "${problem.detail ?? ""}" は ${String(problem.first ?? 0)} 行目と同じです`,
  "unknown-source": (problem) => `${String(problem.line)} 行目: 引用の source "${problem.detail ?? ""}" が sources にありません`,
  "which-source": (problem) =>
    `${String(problem.line)} 行目: 番地 ${problem.detail ?? ""} の引用に source がありません。原文が二つ以上あるときは名前を書いてください`,
  "unknown-language": (problem) => `${String(problem.line)} 行目: language "${problem.detail ?? ""}" は読めません`,
  "unknown-genre": (problem) => `${String(problem.line)} 行目: genre "${problem.detail ?? ""}" は chaff の知らないジャンルです（chaff genres で一覧）`,
  empty: () => "採点する出力が 1 行もありません",
};

const PROBLEM_EN: typeof PROBLEM_JA = {
  "not-json": (problem) => `line ${String(problem.line)}: not valid JSON (${problem.detail ?? ""})`,
  "not-object": (problem) => `line ${String(problem.line)}: write one object {…} per line`,
  "no-id": (problem) => `line ${String(problem.line)}: no id (a non-empty string)`,
  "no-output": (problem) => `line ${String(problem.line)}: no output (a string)`,
  "not-string": (problem) => `line ${String(problem.line)}: ${problem.detail ?? ""} must be a string`,
  "not-text-map": (problem) => `line ${String(problem.line)}: ${problem.detail ?? ""} must be { "name": "text" }`,
  "not-citations": (problem) => `line ${String(problem.line)}: citations must be an array of { "source", "address", "quote" }`,
  "citations-without-sources": (problem) => `line ${String(problem.line)}: citations without sources; put the text they quote in sources`,
  "duplicate-id": (problem) => `line ${String(problem.line)}: id "${problem.detail ?? ""}" is already on line ${String(problem.first ?? 0)}`,
  "unknown-source": (problem) => `line ${String(problem.line)}: the citation's source "${problem.detail ?? ""}" is not in sources`,
  "which-source": (problem) => `line ${String(problem.line)}: the citation of ${problem.detail ?? ""} names no source; with two or more sources, name one`,
  "unknown-language": (problem) => `line ${String(problem.line)}: language "${problem.detail ?? ""}" cannot be read`,
  "unknown-genre": (problem) => `line ${String(problem.line)}: genre "${problem.detail ?? ""}" is not one chaff knows (chaff genres lists them)`,
  empty: () => "no output to grade: the file has no item",
};

const EXPECTED_JA: Readonly<Record<Expected, string>> = {
  map: "キーと値の組（{ … }）",
  count: " 0 以上の整数",
  number: " 0 以上の数",
  boolean: " true か false",
  words: "空でない文字列の並び",
  kinds: `事実の種類（${ATOM_KINDS.join("・")}）の並び`,
  "known-key": "知っているキーだけ",
};

const EXPECTED_EN: Readonly<Record<Expected, string>> = {
  map: "a map ({ … })",
  count: "a whole number from 0",
  number: "a number from 0",
  boolean: "true or false",
  words: "a list of non-empty strings",
  kinds: `a list of fact kinds (${ATOM_KINDS.join(", ")})`,
  "known-key": "a key chaff knows",
};

/** A bracketed aside, or nothing when there is nothing to say. */
const aside = (open: string, inner: string, close: string): string => (inner === "" ? "" : [open, inner, close].join(""));

export const GRADE_TEXT: Texts<GradeText> = {
  ja: {
    usage: "使い方: chaff grade <items.jsonl> [--out <results.jsonl>] [--json] [--compact] [--experimental] [--genre <ジャンル>]",
    noReference: "reference が無い（事実は reference と照らす）",
    noCitations: "citations が無い（chaff は出力から引用を推測しない）",
    unknownRule: "grade: に書かれているが、chaff の知らないルール",
    rubricProblem: (problem) => `chaff.yaml の ${problem.path} は${EXPECTED_JA[problem.expected]}で書いてください（書かれていたのは ${problem.written}）`,
    penalty: (total) => `減点の和: ${String(total)}`,
    noStructure: (source, language) => `原文 ${source} の言語 ${language} のパッケージは文書の構造を読めない`,
    unreadable: (path, why) => `${path} を読めませんでした: ${why}`,
    problem: (problem) => PROBLEM_JA[problem.kind](problem),
    cannotLoad: (why) => `言語パッケージを読み込めません: ${why}`,
    wrote: (path, count) => `出力ごとの結果を書きました: ${path}（${String(count)} 行）`,
    totals: (path, total, passed) => `${path}: ${String(total)} 件の出力、${String(passed)} 件が通り、${String(total - passed)} 件が落ちた`,
    failedHeading: "落ちた出力",
    ratesHeading: (unit) => `ルールごとの率（1,000 ${unit}あたり、指摘のあった出力の数）`,
    unit: { char: "字", word: "語" },
    outputsWith: (count) => `${String(count)} 件`,
    facts: (dropped, added, droppedKinds, addedKinds) =>
      `事実: 落ちた ${String(dropped)}${aside("（", droppedKinds, "）")}、足された ${String(added)}${aside("（", addedKinds, "）")}`,
    citations: (checked, failed) => `引用: ${String(checked)} 件を照らし、${String(failed)} 件が外れた`,
    notRunHeading: (count) => `動かなかったもの ${String(count)} 件`,
    inOutputs: (count) => `${String(count)} 件の出力`,
    stamp: "再現の印",
  },
  en: {
    usage: "usage: chaff grade <items.jsonl> [--out <results.jsonl>] [--json] [--compact] [--experimental] [--genre <genre>]",
    noReference: "no reference given (facts are checked against a reference)",
    noCitations: "no citations given (chaff does not guess quotations from the output)",
    unknownRule: "named under grade: but not a rule chaff knows",
    rubricProblem: (problem) => `chaff.yaml: ${problem.path} must be ${EXPECTED_EN[problem.expected]} (found ${problem.written})`,
    penalty: (total) => `Penalty points: ${String(total)}`,
    noStructure: (source, language) => `the ${language} package cannot read the structure of source ${source}`,
    unreadable: (path, why) => `Could not read ${path}: ${why}`,
    problem: (problem) => PROBLEM_EN[problem.kind](problem),
    cannotLoad: (why) => `Cannot load a language package: ${why}`,
    wrote: (path, count) => `Wrote one result per output: ${path} (${String(count)} lines)`,
    totals: (path, total, passed) => `${path}: ${String(total)} outputs, ${String(passed)} passed, ${String(total - passed)} failed`,
    failedHeading: "Failed outputs",
    ratesHeading: (unit) => `Rule rates (per 1,000 ${unit}, outputs with a finding)`,
    unit: { char: "characters", word: "words" },
    outputsWith: (count) => `${String(count)} ${count === 1 ? "output" : "outputs"}`,
    facts: (dropped, added, droppedKinds, addedKinds) =>
      `Facts: ${String(dropped)} dropped${aside(" (", droppedKinds, ")")}, ${String(added)} added${aside(" (", addedKinds, ")")}`,
    citations: (checked, failed) => `Quotations: ${String(checked)} checked, ${String(failed)} failed`,
    notRunHeading: (count) => `${String(count)} not run`,
    inOutputs: (count) => `${String(count)} ${count === 1 ? "output" : "outputs"}`,
    stamp: "Stamp",
  },
};
