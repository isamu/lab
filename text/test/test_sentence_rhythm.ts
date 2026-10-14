import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { firedRules } from "./rule-run.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";
import { clearlyBelow } from "../packages/chaff/src/detectors/sentence-rhythm.ts";

// sentence-rhythm measures the prose: list items are parallel on purpose, so their even length is the list's form.

const RULE = "sentence-rhythm";
const GENRE = "technical/readme";

const evenSentences = (count: number, size: number): string => Array.from({ length: count }, () => `${"あ".repeat(size)}。`).join("");
const evenItems = (count: number, size: number): string => Array.from({ length: count }, () => `- ${"い".repeat(size)}。`).join("\n");
/** A small deterministic generator, so a failing input can be run again. */
const seeded = (seed: number): (() => number) => {
  const state = { value: seed };
  return () => {
    state.value = (state.value * 1103515245 + 12345) % 2147483648;
    return state.value / 2147483648;
  };
};
const fires = (adapter: LanguageAdapter, source: string): boolean => firedRules(adapter, source, GENRE).includes(RULE);

const CHANGELOG_JA = `# 付箋帳 変更履歴

付箋帳の版ごとの変更点をまとめます。新しい版から順に並べています。

版の番号は「メジャー.マイナー.パッチ」の三つの数で表します。

## 3.1.0（2026年9月1日）

この版では、次の4件の修正を行いました。

- 付箋を複製すると、色が既定の色に戻る不具合を直しました。
- 長い題名の付箋で、一覧の行が崩れる不具合を直しました。
- 削除を取り消すと、並び順が変わる不具合を直しました。
- 起動の直後に、検索欄が使えない不具合を直しました。

あわせて、付箋を期限の近い順に並べ替えられるようにしました。

## 3.0.1（2026年7月14日）

3.0.0 で、設定の画面が開かなくなる不具合を直しました。

## 3.0.0（2026年6月2日）

付箋に期限を付けられるようにしました。期限は通知で知らせます。

## 次の版の予定

次の版 3.2.0 は、2026年11月に公開する予定です。

3.0.0 より前の版をお使いの方は、3.1.0 へ更新してください。更新しても、書いた付箋はそのまま残ります。
`;

const CHANGELOG_EN = `# Pinboard changelog

This page lists what changed in each release of Pinboard. The newest release comes first.

## 3.1.0 (1 September 2026)

This release fixes four bugs.

- Duplicating a note no longer resets its colour to the default.
- A note with a long title no longer breaks its row in the list.
- Undoing a delete no longer changes the order of the notes.
- The search box now works right after the app starts up.

Notes can now be sorted by their due date, nearest first.

## 3.0.1 (14 July 2026)

Fixes a crash when opening the settings page.

## 3.0.0 (2 June 2026)

Notes can have a due date. You get a reminder on the day.

## Next release

Release 3.2.0 is planned for November 2026. If you are on a release before 3.0.0, update to 3.1.0; your notes stay as they are.
`;

describe("sentence-rhythm on changelogs and lists", () => {
  it("valid: a changelog whose bullet items are written alike is not called monotonous (ja)", () => {
    assert.ok(!fires(ja, CHANGELOG_JA));
  });
  it("valid: a changelog whose bullet items are written alike is not called monotonous (en)", () => {
    assert.ok(!fires(en, CHANGELOG_EN));
  });
  it("valid: a few prose sentences around a long list of even items are too few to measure", () => {
    assert.ok(!fires(ja, `${evenSentences(4, 30)}\n\n${evenItems(12, 30)}\n`));
  });
  it("invalid: even prose is still reported when a list of varied items sits beside it", () => {
    const variedItems = [5, 60, 12, 90, 8, 45].map((size) => `- ${"い".repeat(size)}。`).join("\n");
    assert.ok(fires(ja, `${evenSentences(12, 40)}\n\n${variedItems}\n`));
  });
  it("invalid: even prose split over paragraphs is still reported", () => {
    assert.ok(fires(ja, `${evenSentences(6, 40)}\n\n${evenSentences(6, 40)}\n`));
  });
});

describe("sentence-rhythm: clearlyBelow", () => {
  it("invalid: a spread far under the limit is reported however few the sentences", () => {
    assert.ok(clearlyBelow(10, 8, 30));
  });
  it("valid: a spread just under the limit is not reported in a short document", () => {
    assert.ok(!clearlyBelow(29, 11, 30));
  });
  it("invalid: the same spread is reported in a long document", () => {
    assert.ok(clearlyBelow(28, 2000, 30));
  });
  it("valid: a spread at or over the limit is never reported", () => {
    assert.ok(!clearlyBelow(30, 100000, 30));
    assert.ok(!clearlyBelow(45, 8, 30));
  });
  it("invalid: no spread at all is reported", () => {
    assert.ok(clearlyBelow(0, 8, 30));
  });
  it("property: it reports only what the plain limit reports, and the same once the margin is clear of the limit", () => {
    const random = seeded(20261014);
    Array.from({ length: 5000 }, () => ({
      spread: random() * 60,
      sentences: 8 + Math.floor(random() * 3000),
      limit: [20, 30, 35][Math.floor(random() * 3)] ?? 30,
    })).forEach(({ spread, sentences, limit }) => {
      const plain = Math.round(spread) < limit;
      const inputs = `${String(spread)} ${String(sentences)} ${String(limit)}`;
      if (clearlyBelow(spread, sentences, limit)) assert.ok(plain, inputs);
      if (spread + spread / Math.sqrt(2 * sentences) < limit - 1) assert.ok(clearlyBelow(spread, sentences, limit), inputs);
    });
  });
});
