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

// 入力者注の形は 青空文庫 の XHTML のもの、本文は自作。
const withText = (text: string): string => aozoraToMarkdown(page(BIBLIOGRAPHY).replace("　こんな夢を見た。", text));
const note = (text: string): string => `<span class="notes">${text}</span>`;

describe("aozoraToMarkdown: 入力者注（［＃…］）", () => {
  it("valid: 文の途中の注は、空白も残さず落とす", () => {
    assert.ok(withText(`雲は燃えるほど${note("［＃「燃えるほど」は底本では「燃えるほど）」］")}高くなる。`).includes("雲は燃えるほど高くなる。"));
    assert.ok(withText(`五十篇${note("［＃「五十篇」はママ］")}を選んだ。`).includes("五十篇を選んだ。"));
    assert.ok(withText(`一、二${note("［＃「一、二」は底本では「一、2-3」］")}と数えた。`).includes("一、二と数えた。"));
  });

  it("valid: 注の中に傍点の印があっても落とす", () => {
    const text = withText(
      `声は<em class="sesame_dot">はつきり</em>と${note('［＃「<em class="sesame_dot">はつきり</em>と」は底本では「はつきりと」］')}した。`,
    );
    assert.ok(text.includes("声ははつきりとした。"), text);
    assert.ok(!text.includes("［＃"), text);
  });

  it("valid: 改ページの注だけの行は、行ごと消える", () => {
    const text = withText(`一行目<br />\n${note("［＃改ページ］")}<br />\n二行目`);
    assert.ok(!text.includes("［＃"), text);
    assert.ok(text.includes("一行目") && text.includes("二行目"), text);
  });

  it("invalid: 符号化できない字を表す注（※の後の外字注）は残す", () => {
    ["［＃「曾＋りっとう」、17-6］", "［＃「口＋世」、第3水準1-14-87］", "［＃「土へん＋竒」、U+5D5C、12-3］", "［＃二の字点、1-2-22］"].forEach((gaiji) => {
      assert.ok(withText(`君の※${note(gaiji)}を待つ。`).includes(`君の※${gaiji}を待つ。`), gaiji);
    });
  });

  it("invalid: notes 以外の class の span、［＃ で始まらない notes、印の無い［＃ は本文として残す", () => {
    assert.ok(withText('<span class="notes_x">［＃作者の括弧］</span>だ。').includes("［＃作者の括弧］だ。"));
    assert.ok(withText(`${note("作者の注記")}だ。`).includes("作者の注記だ。"));
    assert.ok(withText("作者が［＃改ページ］と書いた。").includes("作者が［＃改ページ］と書いた。"));
  });

  it("異常な入力: 閉じていない span、空の注", () => {
    assert.ok(withText('<span class="notes">［＃改ページ］だ。').includes("［＃改ページ］だ。"));
    assert.ok(withText(`空${note("")}だ。`).includes("空だ。"));
  });
});
