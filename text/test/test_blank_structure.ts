import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { listBlanks, tableBlanks } from "../packages/chaff/src/detectors/blank-structure.ts";

// 表の空欄（empty-table-cell）と、中身の無い箇条書きの項目（empty-list-item）。例文はすべて自作。

const table = (...rows: string[]): string => ["| 期限 | 担当 | 内容 |", "| --- | --- | --- |", ...rows].join("\n");

const names = (blanks: readonly { readonly name: string }[]): string[] => blanks.map((blank) => blank.name);

describe("empty-table-cell: 表の空欄", () => {
  it("ほかの行がすべて埋めている列の、一つだけの空欄を言う", () => {
    const source = table("| 10月16日 | 伊藤 | 修正 |", "| 10月21日 |  | 配布 |", "| 10月28日 | 高橋 | 日程 |");
    assert.deepEqual(names(tableBlanks(source)), ["担当"]);
    assert.equal(source.slice(0, tableBlanks(source)[0]?.offset ?? 0).split("\n").length, 4);
  });

  it("行の終わりで足りないセルも空欄と数え、行の終わりを指す", () => {
    const source = table("| 10月16日 | 伊藤 | 修正 |", "| 10月21日 | 鈴木 |", "| 10月28日 | 高橋 | 日程 |");
    const blanks = tableBlanks(source);
    assert.deepEqual(names(blanks), ["内容"]);
    assert.equal(
      source
        .slice(0, blanks[0]?.offset ?? 0)
        .split("\n")
        .at(-1),
      "| 10月21日 | 鈴木 |",
    );
  });

  it("強調の印や HTML のコメントだけのセルも空欄と数え、コードや画像は中身と数える", () => {
    assert.deepEqual(names(tableBlanks(table("| 10月16日 | 伊藤 | 修正 |", "| 10月21日 | ** ** | 配布 |", "| 10月28日 | 高橋 | 日程 |"))), ["担当"]);
    assert.deepEqual(names(tableBlanks(table("| 10月16日 | 伊藤 | 修正 |", "| 10月21日 | <!-- 未定 --> | 配布 |", "| 10月28日 | 高橋 | 日程 |"))), ["担当"]);
    assert.deepEqual(tableBlanks(table("| 10月16日 | 伊藤 | 修正 |", "| 10月21日 | `bot` | 配布 |", "| 10月28日 | ![顔](a.png) | 日程 |")), []);
  });

  it("一番左の列、空欄が二つある列、本文が三行より少ない表は言わない", () => {
    assert.deepEqual(tableBlanks(table("| 10月16日 | 伊藤 | 修正 |", "|  | 鈴木 | 配布 |", "| 10月28日 | 高橋 | 日程 |")), []);
    assert.deepEqual(tableBlanks(table("| 10月16日 |  | 修正 |", "| 10月21日 |  | 配布 |", "| 10月28日 | 高橋 | 日程 |")), []);
    assert.deepEqual(tableBlanks(table("| 10月16日 | 伊藤 | 修正 |", "| 10月21日 |  | 配布 |")), []);
  });

  it("「—」や「なし」は空欄ではない", () => {
    assert.deepEqual(tableBlanks(table("| 10月16日 | 伊藤 | 修正 |", "| 10月21日 | — | 配布 |", "| 10月28日 | なし | 日程 |")), []);
  });

  it("コードの中の表と、引用した返信の中の表は見ない", () => {
    const source = table("| 10月16日 | 伊藤 | 修正 |", "| 10月21日 |  | 配布 |", "| 10月28日 | 高橋 | 日程 |");
    assert.deepEqual(tableBlanks(`\`\`\`\n${source}\n\`\`\`\n`), []);
    assert.deepEqual(tableBlanks(source, [{ start: 0, end: source.length }]), []);
    assert.deepEqual(
      tableBlanks(
        source
          .split("\n")
          .map((line) => `> ${line}`)
          .join("\n"),
      ),
      [],
    );
  });

  it("規則として、言語ごとの文で言う", () => {
    const source = `# 宿題\n\n${table("| 10月16日 | 伊藤 | 修正 |", "| 10月21日 |  | 配布 |", "| 10月28日 | 高橋 | 日程 |")}\n`;
    assert.deepEqual(namedRuleRun("empty-table-cell", source, ja).findings, ["表の「担当」の列で、この行だけが空欄です"]);
    const english = "# Tasks\n\n| Due | Owner |\n| --- | --- |\n| Oct 16 | Ito |\n| Oct 21 |  |\n| Oct 28 | Sato |\n";
    assert.deepEqual(namedRuleRun("empty-table-cell", english, en).findings, ['The "Owner" column is blank in this row only']);
  });

  it("Markdown でない文書では動かない", () => {
    const source = table("| 10月16日 | 伊藤 | 修正 |", "| 10月21日 |  | 配布 |", "| 10月28日 | 高橋 | 日程 |");
    assert.deepEqual(namedRuleRun("empty-table-cell", source, ja, "a.txt").findings, []);
  });
});

describe("empty-list-item: 中身の無い箇条書きの項目", () => {
  it("ほかの項目に値がある箇条書きの、見出しの語だけの項目を言う", () => {
    assert.deepEqual(names(listBlanks("- 日時：10月14日\n- 場所：第2会議室\n- 担当：\n")), ["担当"]);
    assert.deepEqual(names(listBlanks("- Date: Oct 14\n- **Owner**:\n")), ["Owner"]);
  });

  it("記号だけの項目と、印だけのチェック欄を言う", () => {
    assert.deepEqual(names(listBlanks("- 資料を配る\n-\n- 会場を取る\n")), [""]);
    assert.deepEqual(names(listBlanks("- [ ]\n- [x] 会場を取る\n")), [""]);
  });

  it("記入用の書式（どの項目にも値が無い）と、下に続きのある前置きは言わない", () => {
    assert.deepEqual(listBlanks("- 氏名：\n- 住所：\n- 電話：\n"), []);
    assert.deepEqual(listBlanks("- 日時：10月14日\n- 手順：\n  - 鍵を開ける\n  - 照明をつける\n"), []);
  });

  it("文の並びの中の「〜：」は前置きと読み、記号だけの項目が一つきりの箇条書きは番号の残りと読む", () => {
    assert.deepEqual(listBlanks("- 次の手順で進めます：\n\n- 申請書を出す。\n- 審査を待つ。\n- 結果: 届いたら知らせる。\n"), []);
    assert.deepEqual(listBlanks("本文の段落。\n\n40.\n\n次の段落。\n"), []);
  });

  it("引用の中の箇条書きは見ない", () => {
    assert.deepEqual(listBlanks("> - 日時：10月14日\n> - 担当：\n"), []);
  });

  it("文の途中にコロンがある項目や、長い文は見出しと読まない", () => {
    assert.deepEqual(listBlanks("- 日時：10月14日\n- 次の点に注意してください。会場は：\n"), []);
  });

  it("規則として、言語ごとの文で言う", () => {
    assert.deepEqual(namedRuleRun("empty-list-item", "# 会議\n\n- 日時：10月14日\n- 担当：\n", ja).findings, [
      "「担当」の後に値がありません（同じ箇条書きのほかの項目には書いてあります）",
    ]);
    assert.deepEqual(namedRuleRun("empty-list-item", "# Notes\n\n- Ship the build\n-\n- Tell the team\n", en).findings, ["This list item is empty"]);
  });
});
