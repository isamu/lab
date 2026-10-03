import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { tagCoverage } from "../packages/chaff/src/tag-coverage.ts";
import { prepare, readWith, tokenize } from "../packages/lang-ja/src/pos.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";
import { measuredOffOn } from "../scripts/rules-measure-files.ts";

// 制御文字・片割れのサロゲート・長い並びで、アダプタも run も止まらないこと。kuromoji は NUL で例外を投げた。

const tokenized = { tokens: [] };
const untagged = {};

describe("tagCoverage: token の来た文の割合", () => {
  const cases: readonly (readonly [string, readonly { tokens?: readonly never[] }[], string])[] = [
    ["文が無い", [], "all"],
    ["すべての文", [tokenized, tokenized], "all"],
    ["一部の文", [tokenized, untagged], "some"],
    ["先頭だけ欠ける", [untagged, tokenized, tokenized], "some"],
    ["どの文にも無い", [untagged, untagged], "none"],
    ["空の token 列は token が来た文", [tokenized], "all"],
  ];
  cases.forEach(([name, sentences, expected]) => {
    it(name, () => assert.equal(tagCoverage(sentences), expected));
  });
});

const morpheme = { surface_form: "文", pos: "名詞", pos_detail_1: "一般", pos_detail_2: "*", basic_form: "文" };

describe("readWith: 解析器が投げても外へ出さない", () => {
  it("投げる解析器なら undefined", () => {
    const throwing = {
      tokenize: () => {
        throw new TypeError("Cannot read properties of undefined (reading 'length')");
      },
    };
    assert.equal(readWith(throwing, "日本語の文です。"), undefined);
  });

  it("読めた解析器なら、形態素を本文の位置に置く", () => {
    const reading = { tokenize: () => [morpheme] };
    assert.deepEqual(
      readWith(reading, "文")?.map((placed) => placed.start),
      [0],
    );
  });

  it("NUL は解析器に届かない", () => {
    const seen: string[] = [];
    const recording = {
      tokenize: (text: string) => {
        seen.push(text);
        return [];
      },
    };
    readWith(recording, "前\0後");
    assert.deepEqual(seen, ["前�後"]);
  });
});

const POS_RULE = "agentless-passive";
const PLAIN_RULE = "max-sentence-length";

/** 2 段落目の文から token を落とすアダプタ。lang-ja が、解析器の投げた段落に返す形。 */
const losingSecondParagraph = (base: LanguageAdapter): LanguageAdapter => ({
  ...base,
  segment: (text) => {
    const { sentences } = base.segment(text);
    return { sentences: text.startsWith("二") ? sentences.map(({ span, text: body }) => ({ span, text: body })) : sentences };
  },
});

describe("品詞の取れない段落がある文書", () => {
  before(async () => prepare());

  it("品詞の要る rule は「読めなかった」として動かさず、ほかの rule は動く", () => {
    const source = "一つ目の段落です。協力が求められます。\n\n二つ目の段落です。協力が求められます。\n";
    const result = runRules(
      buildDocument("t.md", source, losingSecondParagraph(ja)),
      loadRules("ja"),
      measuredOffOn("business/report"),
      true,
      "business/report",
    );
    assert.match(result.skipped.find((entry) => entry.rule === POS_RULE)?.why ?? "", /読めなかった/u);
    assert.equal(
      result.skipped.find((entry) => entry.rule === PLAIN_RULE),
      undefined,
    );
  });

  it("NUL を含む文書を読み、品詞の要る rule も動かし、NUL そのものは見えない字として指す", () => {
    const source = "日本語の文です。\0ここに NUL があります。次の文です。\n";
    const result = runRules(buildDocument("nul.md", source, ja), loadRules("ja"), measuredOffOn("business/report"), true, "business/report");
    assert.equal(
      result.skipped.find((entry) => entry.rule === POS_RULE),
      undefined,
    );
    assert.deepEqual(
      result.findings.filter((finding) => finding.rule === "invisible-character").map((finding) => finding.column),
      [source.indexOf("\0") + 1],
    );
    assert.ok((tokenize("前\0後") ?? []).length > 0);
  });
});

/** 種を出して、落ちたときに同じ文字列を作り直せるようにする。線形合同法。 */
const generator = (seed: number): (() => number) => {
  const state = { value: seed };
  return () => {
    state.value = (state.value * 1103515245 + 12345) & 0x7fffffff;
    return state.value / 0x7fffffff;
  };
};

const SEED = 20261001;
const SAMPLES = 60;
/** run 全体は遅いので、長い並びの無い文字列を少しだけ通す。アダプタは長い並びごと全部を読む。 */
const RUN_SAMPLES = 25;
const LONG_RUN = 3000;
const MAX_PIECES = 25;
const C0_END = 0x20;
const SURROGATE_START = 0xd800;
const SURROGATE_SPAN = 0x800;
const LAST_CODE_POINT = 0x10ffff;
const LONG_RUN_CHANCE = 0.05;

const fragments = (random: () => number): readonly (() => string)[] => [
  () => String.fromCharCode(Math.floor(random() * C0_END)),
  () => "\0",
  () => "\u007f",
  () => String.fromCharCode(SURROGATE_START + Math.floor(random() * SURROGATE_SPAN)),
  () => String.fromCodePoint(Math.floor(random() * LAST_CODE_POINT)),
  () => "日本語の文です。",
  () => "This is a sentence. ",
  () => "\n",
  () => "\n\n## 見出し\n\n",
  () => "、",
  () => ["あ", "ア", "a", "1", "　", " ", "😀", "﻿", "￿", "​"][Math.floor(random() * 10)] ?? "",
];

const generated = (random: () => number, longRuns: boolean): string => {
  const pick = fragments(random);
  const count = 1 + Math.floor(random() * MAX_PIECES);
  const pieces = Array.from({ length: count }, () => {
    const piece = pick[Math.floor(random() * pick.length)]?.() ?? "";
    return longRuns && random() < LONG_RUN_CHANCE ? piece.repeat(LONG_RUN) : piece;
  });
  return pieces.join("");
};

const SHOWN = 200;

/** 生成した文字列それぞれで read が投げないこと。落ちたら、その文字列の頭を出す。 */
const neverThrows = (count: number, longRuns: boolean, read: (text: string) => unknown): void => {
  const random = generator(SEED);
  Array.from({ length: count }, () => generated(random, longRuns)).forEach((text) => {
    assert.doesNotThrow(() => read(text), JSON.stringify(text.slice(0, SHOWN)));
  });
};

describe(`生成した文字列でアダプタが投げない（seed ${String(SEED)}）`, () => {
  before(async () => {
    await ja.prepare?.({ pos: true, features: ["LongVowelEnding"] });
    await en.prepare?.({ pos: true });
  });

  [ja, en].forEach((adapter) => {
    it(`${adapter.id}: detect と segment`, () => {
      neverThrows(SAMPLES, true, (text) => [adapter.detect(text), adapter.segment(text)]);
    });

    it(`${adapter.id}: 文書を組み立てて rule を動かす`, () => {
      neverThrows(RUN_SAMPLES, false, (text) => runRules(buildDocument("fuzz.md", text, adapter), loadRules(adapter.id), {}, true, "blog/tech"));
    });
  });
});
