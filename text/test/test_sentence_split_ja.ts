import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { adapter } from "../packages/lang-ja/src/index.ts";

const textsOf = (source: string): string[] => adapter.segment(source).sentences.map((sentence) => sentence.text);

describe("日本語の文分割", () => {
  it("ラテン略語のピリオドで切らない", () => {
    // sentence-splitter は既定で "Dr." を文末と見なして 5 文に割る。spec §7.2。
    const source = "キャッシュのTTLは短くする。「本当に？」と聞かれたが、Dr. 田中は，答えなかった。理由は3.5秒の遅延にある！ただし例外もある（後述）。";
    assert.deepEqual(textsOf(source), [
      "キャッシュのTTLは短くする。",
      "「本当に？」と聞かれたが、Dr. 田中は，答えなかった。",
      "理由は3.5秒の遅延にある！",
      "ただし例外もある（後述）。",
    ]);
  });

  it("小数点と URL のドットで切らない", () => {
    assert.deepEqual(textsOf("遅延は3.5秒だった。詳細は https://example.com/a.b を見てほしい。以上。"), [
      "遅延は3.5秒だった。",
      "詳細は https://example.com/a.b を見てほしい。",
      "以上。",
    ]);
  });

  it("英文混在でも日本語の文末だけで切る", () => {
    assert.deepEqual(textsOf("まず npm i chaff を実行する。次に chaff lint README.md と打つ。終わり。"), [
      "まず npm i chaff を実行する。",
      "次に chaff lint README.md と打つ。",
      "終わり。",
    ]);
  });

  it("鍵括弧の中の句点では切らない", () => {
    assert.deepEqual(textsOf("彼は「やめておく。」と言った。それだけだ。"), ["彼は「やめておく。」と言った。", "それだけだ。"]);
  });

  it("結合してもオフセットが元文字列と一致する", () => {
    // raw を連結すると空白ノードが落ちて文長が縮む。オフセットで繋ぐ理由。spec §7.2。
    const source = "「本当に？」と聞かれたが、Dr. 田中は答えなかった。以上。";
    adapter.segment(source).sentences.forEach((sentence) => {
      assert.equal(sentence.text, source.slice(sentence.span.start, sentence.span.end));
    });
  });

  it("空文字でも落ちない", () => {
    assert.deepEqual(textsOf(""), []);
  });
});
