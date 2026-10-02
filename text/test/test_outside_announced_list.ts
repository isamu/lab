import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { namesInOrder, outsideMembers, type ListStatement } from "../packages/chaff/src/announced-list.ts";
import type { Token } from "../packages/chaff/src/plugin.ts";

// 挙げた一覧に無い名前（outside-announced-list）。例文はすべて自作。

const outside = (source: string, adapter = en): readonly string[] => namedRuleRun("outside-announced-list", source, adapter, "a.md").findings;

describe("outside-announced-list: 挙げた一覧に無い名前", () => {
  before(async () => {
    await en.prepare?.({ pos: true });
    await ja.prepare?.({ pos: true });
  });

  it("a platform the list did not name", () => {
    assert.deepEqual(outside("The app is supported on Windows and macOS. Setup takes five minutes. It is also supported on Linux.\n"), [
      '"Linux" is not in the list given on line 1 (Windows, macOS)',
    ]);
  });

  it("a name already in the list, or an earlier mention, is fine", () => {
    assert.deepEqual(outside("The app is supported on Windows and macOS. It is supported on macOS 14 too.\n"), []);
    assert.deepEqual(outside("It is supported on Linux. The app is supported on Windows and macOS.\n"), []);
  });

  it("languages and platforms are different lists", () => {
    assert.deepEqual(outside("The app is supported on Windows and macOS. The guide is available in English.\n"), []);
    assert.deepEqual(outside("The guide is available in English and French. It is also available in German.\n"), [
      '"German" is not in the list given on line 1 (English, French)',
    ]);
  });

  it("a negated sentence and another list of other names are not compared", () => {
    assert.deepEqual(outside("The app is supported on Windows and macOS. It is not supported on Linux.\n"), []);
    assert.deepEqual(outside("The export is compatible with EndNote and RefWorks. The other export is compatible with BibDesk and LaTeX.\n"), []);
    assert.deepEqual(
      outside("Export A is compatible with EndNote and RefWorks. Export B is compatible with BibDesk and LaTeX. It is also compatible with Zotero.\n"),
      [],
    );
  });

  it("日本語の一覧と、後の「にも対応」「版」", () => {
    assert.deepEqual(outside("対応OSはWindowsとmacOSです。インストールは五分で終わります。Linuxにも対応しています。\n", ja), [
      "「Linux」は、1 行目で挙げた一覧（Windows, macOS）にありません",
    ]);
    assert.equal(outside("対応OSはWindowsとmacOSです。Linux版では設定画面が違います。\n", ja).length, 1);
    assert.deepEqual(outside("対応OSはWindowsとmacOSです。Linuxには対応していません。\n", ja), []);
  });
});

describe("the reading behind outside-announced-list", () => {
  const token = (surface: string, pos: string, start: number): Token => ({ surface, pos, span: { start, end: start + surface.length } });
  const source = "Windows, macOS and Linux today";
  const joiners = new Set([",", "and"]);

  it("namesInOrder reads names joined by commas and and, and stops at another word", () => {
    const tokens = [
      token("Windows", "PROPN", 0),
      token(",", "PUNCT", 7),
      token("macOS", "NOUN", 9),
      token("and", "CCONJ", 15),
      token("Linux", "PROPN", 19),
      token("today", "NOUN", 25),
    ];
    assert.deepEqual(
      namesInOrder(tokens, joiners, source).map((member) => member.name),
      ["Windows", "macOS", "Linux"],
    );
    assert.deepEqual(namesInOrder([token("today", "NOUN", 25), ...tokens], joiners, source), []);
  });

  it("outsideMembers reports each outside name once, against the first list of two or more", () => {
    const statement = (offset: number, ...names: string[]): ListStatement => ({
      group: "platform",
      offset,
      members: names.map((name, index) => ({ name, offset: offset + index })),
    });
    const found = outsideMembers([statement(50, "Linux"), statement(0, "Windows", "macOS"), statement(80, "linux"), statement(90, "macOS", "iOS")]);
    assert.deepEqual(
      found.map(({ member }) => member.name),
      ["Linux", "iOS"],
    );
    const single = outsideMembers([statement(0, "Linux"), statement(10, "Windows", "macOS"), statement(20, "Linux")]);
    assert.deepEqual(
      single.map(({ member }) => `${member.name}@${String(member.offset)}`),
      ["Linux@20"],
    );
  });
});
