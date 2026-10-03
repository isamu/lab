import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { readLists } from "../packages/chaff/src/list-marks.ts";
import { parse } from "../packages/chaff/src/markdown-read.ts";

// Bullets mixed in one list or one document. Self-written examples.

const run = (source: string, adapter = ja, path = "a.md"): readonly string[] => namedRuleRun("list-marker-mix", `${source}\n`, adapter, path).findings;

const lists = (source: string): string[] => readLists(source, parse(source)).lists.map((list) => `${String(list.depth)}${list.mark}${list.previous ?? ""}`);

describe("readLists", () => {
  it("reads each list's bullet and depth, and the list right before it", () => {
    assert.deepEqual(lists("- a\n- b\n* c\n"), ["0-", "0*-"]);
    assert.deepEqual(lists("- a\n  * b\n"), ["0-", "1*"]);
  });

  it("reads two or more lines typed with ・ as a list, and leaves numbered lists, quotations and code", () => {
    assert.deepEqual(lists("・りんご\n・みかん\n"), ["0・"]);
    assert.deepEqual(lists("・注意\n"), []);
    assert.deepEqual(lists("1. a\n2. b\n\n> - c\n\n```\n- d\n```\n"), []);
  });
  it("reads lists nested thousands deep and a long typed list without recursion", () => {
    const deep = `${"- ".repeat(3000)}x\n`;
    assert.equal(readLists(deep, parse(deep)).lists.length, 3000);
    const typed = Array.from({ length: 20000 }, (_unused, at) => `・item ${String(at)}`).join("\n");
    assert.deepEqual(lists(typed), ["0・"]);
  });
});

describe("list-marker-mix", () => {
  it("reports a list whose bullet changes partway", () => {
    assert.deepEqual(run("持ち物です。\n\n- 筆記用具\n- 名札\n* 昼食"), [
      "箇条書きの記号が「-」から「*」に変わっています。Markdown はここでリストを二つに分けます",
    ]);
    assert.deepEqual(run("Bring these.\n\n- A pen\n- Your badge\n+ Lunch", en), ['The bullet changes from "-" to "+"; Markdown starts a new list here']);
  });

  it("reports a ・ line inside a list item", () => {
    assert.deepEqual(run("手順です。\n\n- 準備\n・道具をそろえる\n- 片付け"), [
      "リストの項目の中の「・」の行は箇条書きにならず、前の行につながって表示されます",
    ]);
  });

  it("reports the one list written with another bullet among lists of the same depth", () => {
    const source = [
      "一つ目です。",
      "",
      "- a",
      "- b",
      "",
      "二つ目です。",
      "",
      "- c",
      "- d",
      "",
      "三つ目です。",
      "",
      "- e",
      "- f",
      "",
      "四つ目です。",
      "",
      "* g",
      "* h",
    ].join("\n");
    assert.deepEqual(run(source), ["このリストだけ箇条書きの記号が「*」です（同じ深さのリストは 3 個が「-」）"]);
  });

  it("does not compare depths, a common second bullet, or too few lists, and reads only Markdown", () => {
    assert.deepEqual(run("- a\n  * b\n- c\n  * d\n- e\n  * f", en), []);
    const half = ["One.", "", "- a", "", "Two.", "", "* b", "", "Three.", "", "- c", "", "Four.", "", "* d"].join("\n");
    assert.deepEqual(run(half, en), []);
    assert.deepEqual(run("One.\n\n- a\n\nTwo.\n\n* b", en), []);
    assert.deepEqual(run("Bring these.\n\n- A pen\n* Lunch", en, "a.txt"), []);
  });
});
