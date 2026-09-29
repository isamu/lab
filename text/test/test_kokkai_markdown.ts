import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { kokkaiToMarkdown } from "../scripts/kokkai-markdown.ts";
import { storedText, type DocEntry } from "../scripts/corpus-docs.ts";

// 国会会議録検索システム API の会議を Markdown に。例文はすべて自作。

const speech = (speaker: string, text: string): Record<string, string> => ({ speaker, speech: text });

const response = (speeches: readonly unknown[]): string =>
  JSON.stringify({
    numberOfRecords: 1,
    meetingRecord: [{ session: 999, nameOfHouse: "参議院", nameOfMeeting: "試験委員会", issue: "第1号", date: "2099-01-02", speechRecord: speeches }],
  });

const ROSTER = speech("会議録情報", "令和八十一年一月二日（金曜日）\r\n　　出席者は左のとおり。\r\n　　　　委員長　　　　　　　　試験　太郎君");

describe("kokkaiToMarkdown: 会議の発言を順に段落にする", () => {
  it("会議名を見出しに、発言の各行を段落に。出席者の欄（会議録情報）は落とす", () => {
    const json = response([
      ROSTER,
      speech("試験太郎", "○委員長（試験太郎君）　ただいまから開会いたします。\r\n　本日は案を審査します。"),
      speech("見本花子", "○見本花子君　質問いたします。"),
    ]);
    assert.equal(
      kokkaiToMarkdown(json),
      "# 第999回国会 参議院 試験委員会 第1号（2099-01-02）\n\n○委員長（試験太郎君）　ただいまから開会いたします。\n\n本日は案を審査します。\n\n○見本花子君　質問いたします。\n",
    );
  });

  it("罫線だけの行と空行は落とす", () => {
    const json = response([speech("試験太郎", "○委員長（試験太郎君）　散会します。\r\n　　　　─────────────\r\n\r\n　　　午後三時散会")]);
    assert.equal(kokkaiToMarkdown(json), "# 第999回国会 参議院 試験委員会 第1号（2099-01-02）\n\n○委員長（試験太郎君）　散会します。\n\n午後三時散会\n");
  });

  it("改行が \\n だけでも行に分ける", () => {
    const json = response([speech("試験太郎", "○委員長（試験太郎君）　一行目。\n　二行目。")]);
    assert.match(kokkaiToMarkdown(json), /一行目。\n\n二行目。\n$/u);
  });

  it("発言が会議録情報だけなら、見出しだけが残る", () => {
    assert.equal(kokkaiToMarkdown(response([ROSTER])), "# 第999回国会 参議院 試験委員会 第1号（2099-01-02）\n");
  });

  it("会議が無い応答（番号違い）は黙って空にせず、失敗させる", () => {
    assert.throws(() => kokkaiToMarkdown(JSON.stringify({ numberOfRecords: 0 })), /no meetingRecord/u);
  });

  it("形の違う会議（発言が文字列でない）は会議として読まない", () => {
    assert.throws(() => kokkaiToMarkdown(response([{ speaker: "試験太郎", speech: 1 }])), /no meetingRecord/u);
  });

  it("会議の番号が数でなければ会議として読まない", () => {
    const json = JSON.stringify({
      meetingRecord: [{ session: "999", nameOfHouse: "参議院", nameOfMeeting: "試験", issue: "第1号", date: "2099-01-02", speechRecord: [] }],
    });
    assert.throws(() => kokkaiToMarkdown(json), /no meetingRecord/u);
  });

  it("JSON でない応答は失敗させる", () => {
    assert.throws(() => kokkaiToMarkdown("<html></html>"));
  });

  it("manifest の format が kokkai なら、取ってきた応答をこの変換で保存する", () => {
    const entry: DocEntry = {
      id: "x",
      title: "x",
      genre: "business/meeting-notes",
      language: "ja",
      url: "https://kokkai.ndl.go.jp/api/meeting?issueID=0",
      license: "x",
      redistribute: false,
      format: "kokkai",
    };
    assert.equal(storedText(entry, response([])), "# 第999回国会 参議院 試験委員会 第1号（2099-01-02）\n");
  });
});
