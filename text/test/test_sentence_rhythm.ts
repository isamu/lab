import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { firedRules } from "./rule-run.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// sentence-rhythm measures the prose: list items are parallel on purpose, so their even length is the list's form.

const RULE = "sentence-rhythm";
const GENRE = "technical/readme";

const evenSentences = (count: number, size: number): string => Array.from({ length: count }, () => `${"あ".repeat(size)}。`).join("");
const evenItems = (count: number, size: number): string => Array.from({ length: count }, () => `- ${"い".repeat(size)}。`).join("\n");
const fires = (adapter: LanguageAdapter, source: string): boolean => firedRules(adapter, source, GENRE).includes(RULE);

// The clean changelog of the release-notes planted set, where the rule used to report a spread of 28%.
const CHANGELOG_JA = `# ことのは帳 変更履歴

ことのは帳（デスクトップ版）の版ごとの変更点をまとめます。新しい版から順に並べています。

版の番号は「メジャー.マイナー.パッチ」の三つの数で表します。

## 2.4.0（2026年10月6日）

この版では、次の3件の修正を行いました。

- 長いメモを保存すると、末尾の改行が消えることがある不具合を直しました。
- 検索欄に全角の空白を入れると、結果が空になる不具合を直しました。
- 印刷プレビューで、見出しの文字が重なる不具合を直しました。

あわせて、メモの一覧を更新日の新しい順に並べ替えられるようにしました。

サポート期間：2026年10月6日〜2028年10月5日

## 2.3.1（2026年8月18日）

2.3.0 で、同期の設定画面が開かなくなる不具合を直しました。

## 2.3.0（2026年7月7日）

タグに色を付けられるようにしました。色は8色から選べます。

## 2.2.0（2026年5月12日）

メモを PDF に書き出せるようにしました。

## 次の版の予定

次の版 2.5.0 は、2026年12月8日（火）に公開する予定です。

2.2.0 以前の版をお使いの方は、2.4.0 へ更新してください。更新しても、保存したメモはそのまま残ります。
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
  it("valid: varied prose is not called monotonous when a long list beside it is even", () => {
    const prose = [12, 40, 20, 55, 15, 35, 25, 60, 18].map((size) => `${"あ".repeat(size)}。`).join("");
    assert.ok(!fires(ja, `${prose}\n\n${evenItems(20, 30)}\n`));
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
