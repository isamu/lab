import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { aozoraToMarkdown } from "../scripts/aozora-markdown.ts";

// 青空文庫の XHTML の形を縮めたもの。本文は夏目漱石「夢十夜」（著作権の切れた作品）の一行、奥付は形だけ自作。

const page = (colophon: string): string =>
  [
    "<html><head><title>夏目漱石 夢十夜</title></head><body>",
    '<div class="metadata"><h1 class="title">夢十夜</h1><h2 class="author">夏目漱石</h2></div>',
    '<div class="main_text">　こんな夢を見た。<br /></div>',
    colophon,
    '<div id="card"><a href="JavaScript:goLibCard();">●図書カード</a></div>',
    "</body></html>",
  ].join("\n");

const BIBLIOGRAPHY =
  '<div class="bibliographical_information"><hr /><br />底本：「全集」文庫<br />入力：誰それ<br />校正：誰それ<br />青空文庫作成ファイル：<br /></div>';
const NOTATION =
  '<div class="notation_notes"><hr /><br />●表記について<br /><ul><li>このファイルは W3C 勧告 XHTML1.1 にそった形式で作成されています。</li></ul></div>';

describe("aozoraToMarkdown", () => {
  it("valid: 奥付（底本・入力・校正）と表記についての注は落とし、題名と本文は残す", () => {
    assert.equal(aozoraToMarkdown(page(`${BIBLIOGRAPHY}\n${NOTATION}`)), "# 夢十夜\n\n## 夏目漱石\n\nこんな夢を見た。\n");
  });

  it("valid: class が複数でも、奥付の印があれば落とす", () => {
    const colophon = BIBLIOGRAPHY.replace('"bibliographical_information"', "'extra bibliographical_information'").replace(
      '"notation_notes"',
      '"notation_notes x"',
    );
    assert.equal(
      aozoraToMarkdown(page(`${colophon}\n${NOTATION.replace('"notation_notes"', '"x notation_notes y"')}`)),
      "# 夢十夜\n\n## 夏目漱石\n\nこんな夢を見た。\n",
    );
  });

  it("valid: 表記の注が無い奥付も落とす", () => {
    assert.equal(aozoraToMarkdown(page(BIBLIOGRAPHY)), "# 夢十夜\n\n## 夏目漱石\n\nこんな夢を見た。\n");
  });

  it("invalid: 印の無い段落は、底本と書いてあっても本文として残す", () => {
    const text = aozoraToMarkdown(page('<div class="main_text2">底本：作者が書いた一行。<br /></div>'));
    assert.ok(text.includes("底本：作者が書いた一行。"), text);
  });

  it("invalid: 別の class の語を含むだけの div は残す", () => {
    const text = aozoraToMarkdown(page('<div class="bibliographical_information_note">作者の後書き。<br /></div>'));
    assert.ok(text.includes("作者の後書き。"), text);
  });

  it("異常な入力: 空文字、奥付だけ", () => {
    assert.equal(aozoraToMarkdown(""), "");
    assert.equal(aozoraToMarkdown(BIBLIOGRAPHY).trim(), "");
  });
});
