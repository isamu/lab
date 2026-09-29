import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { htmlToMarkdown } from "../scripts/html-markdown.ts";
import { decodeEntities } from "../scripts/markup-text.ts";

// HTML の報告書を Markdown に。見出し・段落・箇条書き・リンクの文字だけを残す。例文はすべて自作。

describe("htmlToMarkdown: 見出し・段落・箇条書き", () => {
  it("h1〜h6 は # の数、p と div は段落、改行の空白はまとめる", () => {
    const html = "<h1>Annual Report</h1><div><h2>Summary</h2><p>Costs rose\n   in the second\tyear.</p><p>Staff fell.</p></div>";
    assert.equal(htmlToMarkdown(html), "# Annual Report\n\n## Summary\n\nCosts rose in the second year.\n\nStaff fell.\n");
  });

  it("li は - の行、br は改行", () => {
    assert.equal(
      htmlToMarkdown("<p>Two steps:</p><ul><li>Plan <em>early</em></li><li>Review</li></ul><p>Updated May 1<br>2024</p>"),
      "Two steps:\n\n- Plan early\n- Review\n\nUpdated May 1\n2024\n",
    );
  });

  it("リンクは文字だけ、中身の無い項目は残さない", () => {
    assert.equal(htmlToMarkdown('<p>See <a href="https://example.com/r">the report</a>.</p><ul><li></li></ul>'), "See the report.\n");
  });

  it("空の入力は空", () => {
    assert.equal(htmlToMarkdown(""), "");
    assert.equal(htmlToMarkdown("<html><head><title>T</title></head><body></body></html>"), "");
  });
});

describe("htmlToMarkdown: 落とすもの", () => {
  it("script・style・head・nav・表・コメントを、入れ子の表も含めて落とす", () => {
    const html =
      "<html><head><title>Site</title><style>p{}</style></head><body><nav><a href='/'>Home</a></nav><script>var a = '<p>x</p>';</script>" +
      "<!-- note --><p>Kept.</p><table><tr><td><table><tr><td>inner</td></tr></table>outer</td></tr></table><p>Also kept.</p></body></html>";
    assert.equal(htmlToMarkdown(html), "Kept.\n\nAlso kept.\n");
  });

  it("ページ内リンクだけの一覧 (目次) は落とし、ほかの一覧は残す", () => {
    const html =
      '<h2>Contents</h2><ul><li><a href="#s1"><span>Intro</span></a></li><li><a href="#s2">Costs</a></li></ul><ul><li><a href="#s1">Intro</a> and more</li></ul>';
    assert.equal(htmlToMarkdown(html), "## Contents\n\n- Intro and more\n");
    const nested = '<h2>Contents</h2><ul><li><a href="#a">A</a><ul><li><a href="#b">B</a></li></ul></li></ul><h2>Summary</h2><p>Text.</p>';
    assert.equal(htmlToMarkdown(nested), "## Summary\n\nText.\n");
  });

  it("一行にページ内リンクだけがある行は落とし、文の中のページ内リンクは文字を残す", () => {
    const html =
      '<p>Updated May 1<br><a href="#Content">Jump to main text</a></p><p>See <a href="#t1">Table 1</a>.</p><p><a href="#a">A</a> and <a href="#b">B</a></p>';
    assert.equal(htmlToMarkdown(html), "Updated May 1\n\nSee Table 1.\n\nA and B\n");
  });

  it("中身の無くなった見出しは、次が同じか上の階層の見出しか文書の終わりなら落とす", () => {
    const html = "<h1>Report</h1><h2>Contents</h2><h2>Tables</h2><h2>Summary</h2><h3>Detail</h3><p>Text.</p><h2>Footnotes</h2>";
    assert.equal(htmlToMarkdown(html), "# Report\n\n## Summary\n\n### Detail\n\nText.\n");
  });

  it("画像だけの見出し (ロゴ・帯・図) は、画像の代替文字がページの表題 (title) でなければ見出しごと落とす", () => {
    const page = (heading: string): string => `<html><head><title>雨の日の案内｜緑町</title></head><body>${heading}<h2>持ち物</h2><p>傘。</p></body></html>`;
    assert.equal(htmlToMarkdown(page('<h1><img src="logo.png" alt="緑町"></h1>')), "## 持ち物\n\n傘。\n");
    assert.equal(htmlToMarkdown(page('<h1><a href="/"><img src="logo.png" alt="緑町の案内"></a></h1>')), "## 持ち物\n\n傘。\n");
    assert.equal(htmlToMarkdown(page('<h1><img src="band.gif"></h1>')), "## 持ち物\n\n傘。\n");
    assert.equal(htmlToMarkdown(page('<h1><img src="band.gif" alt=""></h1>')), "## 持ち物\n\n傘。\n");
    assert.equal(htmlToMarkdown(page('<h2><img src="a.png" alt="雨の日の案内"></h2>')), "## 持ち物\n\n傘。\n");
    assert.equal(htmlToMarkdown('<h2><img src="p.jpg" alt="A photo"></h2><h2>What happened</h2><p>It rained.</p>'), "## What happened\n\nIt rained.\n");
    assert.equal(htmlToMarkdown('<h1><img src="x.png"></h1><p>Text.</p>'), "Text.\n");
    assert.equal(htmlToMarkdown(page('<h1><img data-alt="雨の日の案内｜緑町" src="x.png"></h1>')), "## 持ち物\n\n傘。\n");
  });

  it("文字も画像も無い見出しは画像の見出しとは別で、そのまま (chaff が見出しとして読まない)", () => {
    assert.equal(htmlToMarkdown("<h2></h2><p>Text.</p>"), "##\n\nText.\n");
  });

  it("画像だけの見出しでも、代替文字がページの表題そのものなら表題として残す。文字や記号のある見出しの画像は今までどおり落とす", () => {
    const page = (heading: string): string => `<html><head><title> 雨の日の
      案内 </title></head><body>${heading}<p>傘。</p></body></html>`;
    assert.equal(htmlToMarkdown(page('<h1><img src="t.png" alt="雨の日の　案内"></h1>')), "# 雨の日の 案内\n\n傘。\n");
    assert.equal(htmlToMarkdown(page("<h1 id=t><img src=t.png alt='雨の日の 案内'></h1>")), "# 雨の日の 案内\n\n傘。\n");
    assert.equal(htmlToMarkdown(page('<h1><img src="a.png" alt="雨の日の"><img src="b.png" alt="案内"></h1>')), "# 雨の日の 案内\n\n傘。\n");
    assert.equal(htmlToMarkdown(page('<h1>雨の日の案内 <img src="i.png" alt="印"></h1>')), "# 雨の日の案内\n\n傘。\n");
    assert.equal(htmlToMarkdown(page('<h1><img src="i.png" alt="印">※</h1>')), "# ※\n\n傘。\n");
    const escaped = '<html><head><title>A &amp;lt; B</title></head><body><h1><img alt="A &amp;lt; B"></h1><p>Text.</p></body></html>';
    assert.equal(htmlToMarkdown(escaped), "# A &lt; B\n\nText.\n");
  });

  it("main 要素があればその中だけを読み、無ければページ全体を読む", () => {
    const html = '<header><a href="/">ホーム</a><p>サイト名</p></header><main id="main"><h1>第1回検討会</h1><p>議事要旨。</p></main><div><p>所在地</p></div>';
    assert.equal(htmlToMarkdown(html), "# 第1回検討会\n\n議事要旨。\n");
    assert.equal(htmlToMarkdown("<div><h1>報告</h1><p>本文。</p></div>"), "# 報告\n\n本文。\n");
    assert.equal(htmlToMarkdown('<script>const tpl = "<main>";</script><main><p>本文。</p></main>'), "本文。\n");
  });

  it('main 要素が無ければ role="main" の要素の中だけを読む。入れ子の同じ要素があっても閉じ位置を取り違えない', () => {
    const html =
      '<div class="tool"><p>スマートフォン版を表示</p><p>文字サイズ</p></div>' +
      '<article id="contents" role="main"><h1>町民一斉清掃</h1><article><p>実施日は日曜日です。</p></article><p>雨天決行。</p></article>' +
      "<article><p>このページの感想</p></article>";
    assert.equal(htmlToMarkdown(html), "# 町民一斉清掃\n\n実施日は日曜日です。\n\n雨天決行。\n");
    assert.equal(htmlToMarkdown('<div role="navigation"><p>メニュー</p></div><div><p>本文。</p></div>'), "本文。\n");
    assert.equal(htmlToMarkdown("<div><p>ROLE=MAIN の話。</p></div>"), "ROLE=MAIN の話。\n");
    assert.equal(htmlToMarkdown('<main><p>本文。</p></main><div role="main"><p>別の枠</p></div>'), "本文。\n");
    assert.equal(htmlToMarkdown('<div><p>新着一覧</p></div><DIV ROLE="main"><p>本文。</p></DIV>'), "本文。\n");
    assert.equal(htmlToMarkdown('<div role="main-menu"><p>メニュー</p></div><div><p>本文。</p></div>'), "メニュー\n\n本文。\n");
    assert.equal(htmlToMarkdown('<div data-role="main"><p>メニュー</p></div><article role="main"><p>本文。</p></article>'), "本文。\n");
    assert.equal(htmlToMarkdown('<div title="x role=main y"><p>メニュー</p></div><article class=page role=main><p>本文。</p></article>'), "本文。\n");
    assert.equal(htmlToMarkdown('<div role="main document"><p>本文。</p></div><div><p>所在地</p></div>'), "本文。\n");
    assert.equal(htmlToMarkdown('<div role="document main"><p>本文。</p></div><div><p>所在地</p></div>'), "本文。\n\n所在地\n");
  });

  it("main も role=main も無ければ、入れ子でない article が一つだけのときその中を読む。二つあればページ全体", () => {
    const html =
      '<div role="region" aria-label="Announcement"><span>We are now a nonprofit!</span> <a href="/about">Learn more</a></div>' +
      '<header><a href="/"><span>Back to the site</span></a></header><div><a href="/license">License: CC BY 4.0</a><div>id:1234 [cs.XX]</div></div>' +
      "<article><h1>Report</h1><p>Text.</p><article><p>Reply.</p></article></article><div><p>Contact</p></div>";
    assert.equal(htmlToMarkdown(html), "# Report\n\nText.\n\nReply.\n");
    assert.equal(htmlToMarkdown("<p>Site</p><article><p>One.</p></article><article><p>Two.</p></article>"), "Site\n\nOne.\n\nTwo.\n");
    assert.equal(htmlToMarkdown("<article><p>Card.</p></article><main><p>Body.</p></main>"), "Body.\n");
    assert.equal(htmlToMarkdown('<article><p>Card.</p></article><div role="main"><p>Body.</p></div>'), "Body.\n");
    assert.equal(htmlToMarkdown("<div><p>Now a nonprofit!</p></div><article><p>Title.</p><p>Text.</p></article>"), "Title.\n\nText.\n");
  });

  it("h1 が article の外にあれば、article は中身の一部なのでページ全体を読む", () => {
    assert.equal(htmlToMarkdown("<h1>Report</h1><article><p>Text.</p></article><p>Lead.</p>"), "# Report\n\nText.\n\nLead.\n");
    assert.equal(htmlToMarkdown("<article><h1>Report</h1><p>Text.</p></article><h1>Other</h1><p>More.</p>"), "# Report\n\nText.\n\n# Other\n\nMore.\n");
  });

  it("href が javascript: のリンク (印刷・共有のボタン) は一行に一つなら落とし、文の中なら文字を残す", () => {
    const html =
      '<p><a href="javascript:void(0)" onclick="window.print();return false;"><span class="i"></span>印刷</a></p><h1>お知らせ</h1>' +
      '<p>詳しくは<a href="javascript:openMap()">地図</a>をご覧ください。</p><p><a href=\' JavaScript:share()\'>共有</a> | <a href="#top">上へ</a></p>' +
      '<p><a href="/javascript-guide.html">JavaScript の手引き</a></p><p><a href=javascript.html>JS</a></p>';
    assert.equal(htmlToMarkdown(html), "# お知らせ\n\n詳しくは地図をご覧ください。\n\nJavaScript の手引き\n\nJS\n");
  });

  it("表題 (h1) の前にあり、リンクだけの項目が二つ以上続いて最後の項目が表題そのものの一覧はパンくずとして落とす", () => {
    const trail = '<ol><li><a href="/">ホーム</a></li><li><a href="/news/">お知らせ</a></li><li> 窓口の&amp;変更 </li></ol>';
    assert.equal(htmlToMarkdown(`${trail}<h1><span>窓口の</span>&amp;変更</h1><p>本文。</p>`), "# 窓口の&変更\n\n本文。\n");
    assert.equal(htmlToMarkdown(`<ul><li><a href="/">Top</a></li></ul>${trail}<h1>窓口の&amp;変更</h1><p>本文。</p>`), "# 窓口の&変更\n\n本文。\n");
  });

  it("表題の後ろ・最後の項目が表題と違う・リンクを含む・前のリンクが一つだけ・前の項目に文が混じる・h1 が無い一覧は残す", () => {
    const links = '<li><a href="/a">A</a></li><li><a href="/b">B</a></li>';
    assert.equal(
      htmlToMarkdown(`<h1>Submit Appeal</h1><p>Read these in order.</p><ol>${links}<li>Submit Appeal</li></ol>`),
      "# Submit Appeal\n\nRead these in order.\n\n- A\n- B\n- Submit Appeal\n",
    );
    const title = "<h1>Help</h1><p>Text.</p>";
    assert.equal(htmlToMarkdown(`<ul>${links}<li>Call us for C</li></ul>${title}`), "- A\n- B\n- Call us for C\n\n# Help\n\nText.\n");
    assert.equal(htmlToMarkdown(`<ul>${links}<li>Help <a href="/c">now</a></li></ul>${title}`), "- A\n- B\n- Help now\n\n# Help\n\nText.\n");
    assert.equal(htmlToMarkdown(`<ul><li><a href="/">Home</a></li><li>Help</li></ul>${title}`), "- Home\n- Help\n\n# Help\n\nText.\n");
    assert.equal(
      htmlToMarkdown(`<ul><li><a href="/a">A</a> first</li><li><a href="/b">B</a></li><li>Help</li></ul>${title}`),
      "- A first\n- B\n- Help\n\n# Help\n\nText.\n",
    );
    assert.equal(htmlToMarkdown(`<ul>${links}<li>Help</li></ul><h2>Help</h2><p>Text.</p>`), "- A\n- B\n- Help\n\n## Help\n\nText.\n");
  });

  it("表題 (h1) の前で閉じ、メニューを持つブロックはサイトの頭として、標語や見出し語ごと丸ごと落とす", () => {
    const menu = '<ul><li><a href="/">ホーム</a></li><li><a href="/faq/">よくある質問</a></li></ul>';
    const title = "<div><h1>意見の募集について</h1><p>本文。</p></div>";
    assert.equal(htmlToMarkdown(`<div id="top"><div><p>みんなのくらしのために</p>${menu}</div></div>${title}`), "# 意見の募集について\n\n本文。\n");
    const labelled = '<dl><dt>文字の大きさ</dt><dd><a href="#n">標準</a></dd><dd><a href="#l">大</a></dd></dl>';
    assert.equal(htmlToMarkdown(`<div>${labelled}</div>${title}`), "# 意見の募集について\n\n本文。\n");
    assert.equal(htmlToMarkdown(`<dl><dt>ご意見はこちら</dt><dd><a href="/sanka/">参加の場</a></dd></dl>${title}`), "# 意見の募集について\n\n本文。\n");
    const heading = "<header><h1>計画</h1></header><p>本文。</p>";
    assert.equal(htmlToMarkdown(`<section><p>お知らせ</p>${menu}</section><div><p>標語</p>${menu}</div>${heading}`), "# 計画\n\n本文。\n");
    assert.equal(htmlToMarkdown(`<header><p>サイトの名前</p>${menu}</header>${heading}`), "# 計画\n\n本文。\n");
    assert.equal(htmlToMarkdown(`<div><p>Office of 3.5 Plans</p>${menu}</div>${heading}`), "# 計画\n\n本文。\n");
  });

  it("表題の前でもメニューの無いブロック、語の混じる定義、表題を含むブロック、表題の後ろのブロック、h1 の無いページでは本文を残す", () => {
    const title = "<h1>AGENCY:</h1><p>Text.</p>";
    const docket = "<div><h6>National Institute of Standards</h6><ol><li>[Docket Number: 260805-0401]</li><li>RIN 0693-XC139</li></ol></div>";
    assert.equal(
      htmlToMarkdown(`${docket}${title}`),
      "###### National Institute of Standards\n\n- [Docket Number: 260805-0401]\n- RIN 0693-XC139\n\n# AGENCY:\n\nText.\n",
    );
    assert.equal(
      htmlToMarkdown(`<div><dl><dt>Contact</dt><dd><a href="/office">Office</a></dd><dd>Call <a href="tel:1">the office</a> first.</dd></dl></div>${title}`),
      "Contact\n\nOffice\n\nCall the office first.\n\n# AGENCY:\n\nText.\n",
    );
    assert.equal(
      htmlToMarkdown(`<div><p>Dates</p><dl><dt>Issued</dt><dt>Revised</dt></dl></div>${title}`),
      "Dates\n\nIssued\n\nRevised\n\n# AGENCY:\n\nText.\n",
    );
    const menu = '<ul><li><a href="/a">A</a></li><li><a href="/b">B</a></li></ul>';
    assert.equal(htmlToMarkdown(`<div><p>Lead line</p>${menu}<h1>Plan</h1><p>Text</p></div>`), "Lead line\n\n# Plan\n\nText\n");
    assert.equal(htmlToMarkdown(`<h1>Plan</h1><div><p>See also</p>${menu}</div>`), "# Plan\n\nSee also\n");
    assert.equal(htmlToMarkdown(`<div><p>Our motto.</p>${menu}</div><h2>Plan</h2><p>Text.</p>`), "Our motto.\n\n## Plan\n\nText.\n");
    assert.equal(
      htmlToMarkdown(`<div><p>National Institute of Standards</p><p>Docket 26-0401</p><div><p>Help</p>${menu}</div></div>${title}`),
      "National Institute of Standards\n\nDocket 26-0401\n\n# AGENCY:\n\nText.\n",
    );
    const labelled = '<dl><dt>文字の大きさ</dt><dd><a href="#n">標準</a></dd><dd><a href="#l">大</a></dd></dl>';
    assert.equal(htmlToMarkdown(`<div><p>省の名前</p>${labelled}</div>${title}`), "省の名前\n\n# AGENCY:\n\nText.\n");
    const due = (mark: string): string => `<div><p>Comments are due by May 1${mark}</p>${menu}</div>${title}`;
    assert.equal(htmlToMarkdown(due(".")), "Comments are due by May 1.\n\n# AGENCY:\n\nText.\n");
    assert.equal(htmlToMarkdown(due("?")), "Comments are due by May 1?\n\n# AGENCY:\n\nText.\n");
    assert.equal(htmlToMarkdown(due(".”")), "Comments are due by May 1.”\n\n# AGENCY:\n\nText.\n");
    assert.equal(htmlToMarkdown(due(".)")), "Comments are due by May 1.)\n\n# AGENCY:\n\nText.\n");
    assert.equal(htmlToMarkdown(`<div><p>募集は5月1日までです。</p>${menu}</div>${title}`), "募集は5月1日までです。\n\n# AGENCY:\n\nText.\n");
    assert.equal(
      htmlToMarkdown(`<dl><dt>Want to comment?</dt><dd><a href="/c">Comment form</a></dd></dl>${title}`),
      "Want to comment?\n\nComment form\n\n# AGENCY:\n\nText.\n",
    );
  });

  it("表題の前の、見出し語とパンくずの定義リスト・画像だけのボタンの一覧と見出し語・リンクだけのブロックはサイトの頭として落とす", () => {
    const title = "<h1>熱中症の防止について</h1><p>本文。</p>";
    const trail = '<a href="/">トップ</a>&nbsp;&gt;&nbsp;<a href="/kyoiku/">教育</a>&nbsp;&gt;&nbsp;熱中症の防止について';
    assert.equal(htmlToMarkdown(`<dl><dt>現在位置</dt><dd>${trail}</dd></dl>${title}`), "# 熱中症の防止について\n\n本文。\n");
    const sizes = '<ul><li id="n"><img src="n.png" alt="標準"></li><li><button><img src="l.png" alt="拡大"></button></li></ul>';
    assert.equal(htmlToMarkdown(`<div><p>文字サイズ変更</p>${sizes}</div>${title}`), "# 熱中症の防止について\n\n本文。\n");
    const lone = '<div><div><a href="/en/">English</a></div><div><a href="/map.html">サイトマップ</a></div></div>';
    assert.equal(htmlToMarkdown(`${lone}${title}`), "# 熱中症の防止について\n\n本文。\n");
    assert.equal(htmlToMarkdown(`<header><a href="/a">A</a> <a href="/b">B</a></header>${title}`), "# 熱中症の防止について\n\n本文。\n");
  });

  it("パンくずでない定義・語のある一覧・空の一覧・文や語の混じるリンク・表題の後ろのリンクだけのブロックは残す", () => {
    const title = "<h1>Plan</h1><p>Text.</p>";
    assert.equal(
      htmlToMarkdown(`<dl><dt>現在位置</dt><dd><a href="/">トップ</a> &gt; この頁</dd></dl>${title}`),
      "現在位置\n\nトップ > この頁\n\n# Plan\n\nText.\n",
    );
    assert.equal(
      htmlToMarkdown(`<dl><dt>Path</dt><dd><a href="/">Home</a> &gt; <a href="/r">Reports</a> &gt; Plan</dd><dd>Filed by the office</dd></dl>${title}`),
      "Path\n\nHome > Reports > Plan\n\nFiled by the office\n\n# Plan\n\nText.\n",
    );
    assert.equal(
      htmlToMarkdown(`<h1>Plan</h1><dl><dt>Path</dt><dd><a href="/">Home</a> &gt; <a href="/r">Reports</a> &gt; Plan</dd></dl>`),
      "# Plan\n\nPath\n\nHome > Reports > Plan\n",
    );
    assert.equal(htmlToMarkdown(`<div><p>Figures</p><ul><li><img alt="a">Chart one</li></ul></div>${title}`), "Figures\n\n- Chart one\n\n# Plan\n\nText.\n");
    assert.equal(htmlToMarkdown(`<div><p>Figures</p><ul></ul></div>${title}`), "Figures\n\n# Plan\n\nText.\n");
    assert.equal(htmlToMarkdown(`<div><p>By <a href="/staff/jane">Jane Doe</a></p></div>${title}`), "By Jane Doe\n\n# Plan\n\nText.\n");
    assert.equal(htmlToMarkdown(`<div><a href="/guide">Read the guide first.</a></div>${title}`), "Read the guide first.\n\n# Plan\n\nText.\n");
    assert.equal(htmlToMarkdown(`<div><a href="/n1"><h3>News one</h3><p>Summary</p></a></div>${title}`), "### News one\n\nSummary\n\n# Plan\n\nText.\n");
    assert.equal(htmlToMarkdown(`<p>Kept</p><div><a href="/en/">English</a></div><h2>Plan</h2><p>Text.</p>`), "Kept\n\nEnglish\n\n## Plan\n\nText.\n");
    assert.equal(htmlToMarkdown(`${title}<div><a href="/en/">English</a></div>`), "# Plan\n\nText.\n\nEnglish\n");
  });

  it("aside・footer・form (検索窓) を落とす", () => {
    const html =
      '<form action="/search"><label for="q">サイト内検索</label><input id="q"></form><h1>計画</h1><p>本文。</p>' +
      "<aside><p>関連ページ</p></aside><footer><p>© 2024 Example Office</p></footer>";
    assert.equal(htmlToMarkdown(html), "# 計画\n\n本文。\n");
  });

  it("リンクだけの項目から成る一覧 (メニュー) はページ外へのリンクでも落とし、文の混じる一覧は残す", () => {
    const html =
      '<ul><li><a href="/about">紹介</a></li><li><a href="/news">報道</a><ul><li><a href="/news/2024">2024年</a></li></ul></li></ul>' +
      '<p>本文。</p><ul><li><a href="/a.pdf">資料1</a>（PDF）</li></ul>';
    assert.equal(htmlToMarkdown(html), "本文。\n\n- 資料1（PDF）\n");
  });

  it("role=navigation の要素と breadcrumb と名札の付いた要素は、nav でなくても落とす", () => {
    const html =
      '<div role="navigation"><a href="/">Home</a><span>Site map</span></div><ol aria-label="Breadcrumb"><li><a href="/">Home</a></li><li>Plan</li></ol>' +
      '<ul aria-label=breadcrumbs><li><a href="/">Home</a></li><li>Plan</li></ul>' +
      '<h1>Plan</h1><div role="note"><p>Kept.</p></div>';
    assert.equal(htmlToMarkdown(html), "# Plan\n\nKept.\n");
  });

  it("> でつないだリンクの列 (パンくず) は落とし、文の中の > は残す", () => {
    const html =
      '<div><a href="/">Home</a> &gt; <a href="/reports">Reports</a> &gt; Annual report</div><h1>Annual report</h1>' +
      '<p>Open <a href="/settings">Settings</a> &gt; <a href="/privacy">Privacy</a> to change it.</p><p><a href="/income">Income</a> / <a href="/people">population</a> / year</p>';
    assert.equal(htmlToMarkdown(html), "# Annual report\n\nOpen Settings > Privacy to change it.\n\nIncome / population / year\n");
  });

  it("リンクだけのブロック (前後のページ、補助リンク) は入れ子でも落とし、リンク一つの段落・カード・文の混じる段落は残す", () => {
    const html =
      '<h1>Chapter 2</h1><p>Text.</p><p><a href="/r.pdf">Full report (PDF)</a></p>' +
      '<div><div><a href="ch1.html">Chapter 1</a></div><div><a href="ch3.html">Chapter 3</a></div></div>' +
      '<div><a href="/">Top page</a><br><a href="/help">Help</a></div><p><a rel="next" href="ch3.html">Next</a></p><p><a rel=next href=ch3.html>Next</a></p>' +
      '<section><a href="ch1.html">Previous</a> <a href="ch3.html">Following</a></section>' +
      '<div><a href="/n1"><h3>News one</h3><p>First summary.</p></a><a href="/n2"><h3>News two</h3><p>Second summary.</p></a></div>' +
      '<p><a href="/terms">Terms</a> | <a href="/privacy">Privacy</a></p><p><a href="/a">A</a> and <a href="/b">B</a> apply.</p>';
    assert.equal(
      htmlToMarkdown(html),
      "# Chapter 2\n\nText.\n\nFull report (PDF)\n\n### News one\n\nFirst summary.\n\n### News two\n\nSecond summary.\n\nA and B apply.\n",
    );
  });

  it("ページ内リンクと ▲ や | のような記号だけの行は落とし、rel=next のリンクも文の中なら文字を残す", () => {
    const html =
      '<h2>Costs</h2><p>Costs rose.</p><p>▲ <a href="#toc">Back to contents</a></p><p><a href=#top>Top</a></p><p>| <a href="#a">A</a> | <a href="#b">B</a> |</p>' +
      '<p>Read <a rel="next" href="ch3.html">the next chapter</a> first.</p>';
    assert.equal(htmlToMarkdown(html), "## Costs\n\nCosts rose.\n\nRead the next chapter first.\n");
  });

  it("ページの最後にある著作権表示は footer の外でも落とし、途中にあるものは残す", () => {
    const html = "<p>© 2020 figures are revised below.</p><p>Text.</p><div><span>Copyright &copy; 2009 Example Office All Rights Reserved.</span></div>";
    assert.equal(htmlToMarkdown(html), "© 2020 figures are revised below.\n\nText.\n");
    const underHeading = "<h1>Plan</h1><p>Text.</p><h2>About this site</h2><p>© 2024 Example Office</p><h2>Related</h2>";
    assert.equal(htmlToMarkdown(underHeading), "# Plan\n\nText.\n");
  });

  it("年の無い著作権表示も © の記号があればページの最後で落とし、(c) や Copyright で始まる文は残す", () => {
    const body = "<h1>Plan</h1><p>Text.</p>";
    assert.equal(htmlToMarkdown(`${body}<p>Copyright &copy; Example Office, All Rights reserved.</p>`), "# Plan\n\nText.\n");
    assert.equal(htmlToMarkdown(`${body}<p>Copyright (c) Example Office</p>`), "# Plan\n\nText.\n");
    assert.equal(htmlToMarkdown(`${body}<p>© Example Office</p>`), "# Plan\n\nText.\n");
    assert.equal(htmlToMarkdown(`${body}<p>(c) The office publishes the plan.</p>`), "# Plan\n\nText.\n\n(c) The office publishes the plan.\n");
    assert.equal(htmlToMarkdown(`${body}<p>Copyright law applies to the plan.</p>`), "# Plan\n\nText.\n\nCopyright law applies to the plan.\n");
    assert.equal(htmlToMarkdown(`<p>© Example Office</p>${body}`), "© Example Office\n\n# Plan\n\nText.\n");
  });

  it("著作権表示とだけブロックを分け、著作権表示だけが後に続く address はサイトの連絡先として落とす", () => {
    const body = "<h1>意見の募集</h1><p>本文。</p>";
    const address = "<address>〒100-0001 東京都千代田区1-1<br>電話：03-0000-0000</address>";
    const notice = "<p>Copyright &copy; Example Office</p>";
    assert.equal(htmlToMarkdown(`${body}<div><p><a href="/"><img alt="省"></a></p>${address}${notice}</div>`), "# 意見の募集\n\n本文。\n");
    assert.equal(htmlToMarkdown(`${body}<section><div><div>${address}</div></div>${notice}</section>`), "# 意見の募集\n\n本文。\n");
    assert.equal(htmlToMarkdown(`<div>${body}<div>${address}${notice}</div></div>`), "# 意見の募集\n\n本文。\n");
    assert.equal(
      htmlToMarkdown(`<div>${body}<p>本文の続き。</p><address>〒100-0002 東京都</address></div><div>${address}${notice}</div>`),
      "# 意見の募集\n\n本文。\n\n本文の続き。\n\n〒100-0002 東京都\n",
    );
  });

  it("文や見出し語とブロックを分ける address、後にほかのものが続くか何も続かない address、ブロックの外の address は残す", () => {
    const body = "<h1>意見の募集</h1><p>本文。</p>";
    const address = "<address>〒100-0001 東京都千代田区1-1<br>電話：03-0000-0000</address>";
    const lines = "〒100-0001 東京都千代田区1-1\n電話：03-0000-0000";
    const notice = "<p>Copyright &copy; Example Office</p>";
    assert.equal(htmlToMarkdown(`${body}<div>${address}</div>`), `# 意見の募集\n\n本文。\n\n${lines}\n`);
    assert.equal(htmlToMarkdown(`${body}<div>${address}<p>受付は平日のみ</p>${notice}</div>`), `# 意見の募集\n\n本文。\n\n${lines}\n\n受付は平日のみ\n`);
    assert.equal(htmlToMarkdown(`${body}<div><p>Send comments to:</p>${address}${notice}</div>`), `# 意見の募集\n\n本文。\n\nSend comments to:\n\n${lines}\n`);
    assert.equal(htmlToMarkdown(`<div>${body}${address}</div><div>${notice}</div>`), `# 意見の募集\n\n本文。\n\n${lines}\n`);
    assert.equal(htmlToMarkdown(`${body}${address}${notice}`), `# 意見の募集\n\n本文。\n\n${lines}\n`);
    assert.equal(htmlToMarkdown(`${body}<div>${notice}${address}</div>`), `# 意見の募集\n\n本文。\n\nCopyright © Example Office\n\n${lines}\n`);
    assert.equal(
      htmlToMarkdown(`${body}<div>${address}${notice}</div><p>受付は平日のみ</p>`),
      `# 意見の募集\n\n本文。\n\n${lines}\n\nCopyright © Example Office\n\n受付は平日のみ\n`,
    );
  });

  it("XML 宣言は本文にしない", () => {
    assert.equal(htmlToMarkdown('<?xml version="1.0" encoding="Shift_JIS"?><html><body><p>本文。</p></body></html>'), "本文。\n");
  });

  it("脚注の上付き番号は落とし、ほかの上付き文字は残す", () => {
    assert.equal(htmlToMarkdown('<p>Costs rose.<sup><a href="#fn1" name="ifn1">1</a></sup> The 25<sup>th</sup> year.</p>'), "Costs rose. The 25th year.\n");
  });

  it("タグを外してから文字参照を戻すので、書かれた < > は文字のまま", () => {
    assert.equal(htmlToMarkdown("<p>If a &lt; b &amp;&amp; c&gt;d &mdash; &#x41;&#66;</p>"), "If a < b && c>d — AB\n");
    assert.equal(htmlToMarkdown("<p>&larr; &uarr; &rarr; &darr;</p>"), "← ↑ → ↓\n");
  });
});

describe("htmlToMarkdown: ボタン・隠れた要素・見出しの自己リンク", () => {
  it("button は操作の部品なので落とす。見出しの中の button (アコーディオンの題) は残す", () => {
    assert.equal(htmlToMarkdown("<p>Annual report</p><button>Close</button><p>Costs rose.</p>"), "Annual report\n\nCosts rose.\n");
    assert.equal(htmlToMarkdown('<p>Fees rose.<button type="button">Share <i></i></button></p>'), "Fees rose.\n");
    assert.equal(htmlToMarkdown("<h3><button>Who may apply</button></h3><div><p>Any resident.</p></div>"), "### Who may apply\n\nAny resident.\n");
    assert.equal(htmlToMarkdown("<h3>Step 2 <button>Expand</button></h3><p>Sign.</p>"), "### Step 2 Expand\n\nSign.\n");
  });

  it("hidden 属性の要素は落とす。until-found・aria-hidden・class の hidden は残す", () => {
    const tooltip = "<h1>Moving a site<span hidden data-x><span>Save this page</span></span></h1><p>Plan first.</p>";
    assert.equal(htmlToMarkdown(tooltip), "# Moving a site\n\nPlan first.\n");
    assert.equal(htmlToMarkdown('<div hidden="">Menu</div><p>Kept.</p><ul hidden="hidden"><li>A</li></ul>'), "Kept.\n");
    assert.equal(htmlToMarkdown('<div hidden="until-found"><p>Answer.</p></div>'), "Answer.\n");
    assert.equal(htmlToMarkdown('<div hidden=until-found><p>Answer.</p></div><div hidden="until-found-later">Menu</div>'), "Answer.\n");
    assert.equal(htmlToMarkdown('<p aria-hidden="true">Shown.</p><p class="hidden">Too.</p><p data-hidden>And.</p>'), "Shown.\n\nToo.\n\nAnd.\n");
    assert.equal(htmlToMarkdown('<p title="not hidden">Plain.</p><p hidden-note="1">Noted.</p>'), "Plain.\n\nNoted.\n");
  });

  it("見出しの直後で自分の節を指すリンク (Copy link to …) は落とす", () => {
    const copy = '<div id="s1"><h2>Context</h2> <a href="https://example.org/r.html#s1"><span>Copy link to Context</span></a></div><p>Rain fell.</p>';
    assert.equal(htmlToMarkdown(copy), "## Context\n\nRain fell.\n");
    assert.equal(htmlToMarkdown('<h2 id="c">Context</h2><a href="#c">Link to this section</a><p>x.</p>'), "## Context\n\nx.\n");
    assert.equal(htmlToMarkdown('<h2><span id="c">Context</span></h2><a href="https://example.org/r#c">Permalink</a><p>x.</p>'), "## Context\n\nx.\n");
  });

  it("見出しの直後でも、自分の節でない先・無い id・間に文字があるリンクは残す", () => {
    const earlier = '<div id="a"><h2>Scope</h2><p>x.</p><h2>Terms</h2><a href="https://example.org/r#a">Back to scope and more</a></div>';
    assert.equal(htmlToMarkdown(earlier), "## Scope\n\nx.\n\n## Terms\n\nBack to scope and more\n");
    assert.equal(htmlToMarkdown('<h2 id="c">Context</h2><a href="https://example.org/r#nowhere">Read the annex</a>'), "## Context\n\nRead the annex\n");
    assert.equal(htmlToMarkdown('<h2 id="c">Context</h2>See <a href="https://example.org/r#c">the annex</a>.'), "## Context\n\nSee the annex.\n");
    const later = '<h2>Context</h2><a href="https://example.org/r#d">Details below</a><div id="d"><p>y.</p></div>';
    assert.equal(htmlToMarkdown(later), "## Context\n\nDetails below\n\ny.\n");
    assert.equal(htmlToMarkdown('<div id=""><h2>Context</h2><a href="https://example.org/annex">Annex</a></div>'), "## Context\n\nAnnex\n");
    const twice = '<h2 id="x">One</h2><p>a.</p><h2><span id="x">Two</span></h2><a href="https://example.org/r#x">Jump to one</a>';
    assert.equal(htmlToMarkdown(twice), "## One\n\na.\n\n## Two\n\nJump to one\n");
    const note = '<p>Note <span id="n">one</span>.</p><h2>Terms</h2><a href="https://example.org/r#n">Read the note</a>';
    assert.equal(htmlToMarkdown(note), "Note one.\n\n## Terms\n\nRead the note\n");
  });

  it("見出しの中の自己リンクは、文字の無い印 (¶ など) なら落とし、語のあるものは題として残す", () => {
    assert.equal(htmlToMarkdown('<h2 id="scope">Scope<a href="#scope" title="Link">¶</a></h2><p>x.</p>'), "## Scope\n\nx.\n");
    assert.equal(htmlToMarkdown('<h2 id="a b">Scope <a href="#a%20b">¶</a></h2><p>x.</p>'), "## Scope\n\nx.\n");
    assert.equal(htmlToMarkdown('<h2 id="a&amp;b">Scope <a href="#a&amp;b">¶</a></h2><p>x.</p>'), "## Scope\n\nx.\n");
    assert.equal(htmlToMarkdown('<h2 id="概要">概要<a href="#%E6%A6%82%E8%A6%81">¶</a></h2><p>x.</p>'), "## 概要\n\nx.\n");
    assert.equal(htmlToMarkdown('<h2 id="%">Scope <a href="#%">¶</a></h2><p>x.</p>'), "## Scope\n\nx.\n");
    assert.equal(htmlToMarkdown('<section id="intro"><h2><a href="#intro">Introduction</a></h2><p>x.</p></section>'), "## Introduction\n\nx.\n");
    assert.equal(htmlToMarkdown('<h2 id="x"><a href="#x">Title</a> (revised)</h2><p>x.</p>'), "## Title (revised)\n\nx.\n");
    assert.equal(htmlToMarkdown('<h2 id="x"><a href="#x">2.1</a> Scope <a href="#x">#</a></h2><p>x.</p>'), "## 2.1 Scope\n\nx.\n");
    assert.equal(htmlToMarkdown('<h2 id="s">Scope <a href="https://example.org/law">Act</a></h2><p>x.</p>'), "## Scope Act\n\nx.\n");
  });

  it("ページ内リンクだけの見出しも見出し (目次へ戻るリンク、開閉のリンク)", () => {
    const pep =
      '<ul><li><a id="t1" href="#intro">Introduction</a></li><li><a id="t2" href="#layout">Layout</a></li></ul>' +
      '<section id="intro"><h2><a class="toc-backref" href="#t1" role="doc-backlink">Introduction</a></h2><p>Style matters.</p></section>' +
      '<section id="layout"><h2><a href="#t2">Layout</a></h2><p>Use spaces.</p></section>';
    assert.equal(htmlToMarkdown(pep), "## Introduction\n\nStyle matters.\n\n## Layout\n\nUse spaces.\n");
    assert.equal(htmlToMarkdown('<h3><a class="toggle" href="#">Keeping cool</a></h3><div><p>Drink water.</p></div>'), "### Keeping cool\n\nDrink water.\n");
  });

  it("見出しでない行のページ内リンクは、これまでどおり落とす", () => {
    assert.equal(htmlToMarkdown('<p>Text.</p><p><a href="#top">Back to top</a></p><p>More.</p>'), "Text.\n\nMore.\n");
  });
});

describe("htmlToMarkdown: pre (整形済みの文字)", () => {
  it("code 一つだけを包む pre はコードの囲み (```) にし、字下げも行もそのまま", () => {
    const html = '<p>Set it:</p><pre class="copy"><code class="json">{\n  &quot;id&quot;: &lt;1&gt;,\n  <span>"on"</span>: true\n}\n</code></pre><p>Done.</p>';
    assert.equal(htmlToMarkdown(html), 'Set it:\n\n```\n{\n  "id": <1>,\n  "on": true\n}\n```\n\nDone.\n');
  });

  it("code の無い pre は行を保ち、一行ずつ段落にする (詩・住所・掲示)", () => {
    const html = "<h2>Rules</h2><pre><span></span>Keep it short.\nKeep it plain.\n\n   Ask first.\n</pre><p>End.</p>";
    assert.equal(htmlToMarkdown(html), "## Rules\n\nKeep it short.\n\nKeep it plain.\n\nAsk first.\n\nEnd.\n");
    assert.equal(htmlToMarkdown("<pre>Line one<br>Line two</pre>"), "Line one\n\nLine two\n");
  });

  it("言語を名乗る class (pre か、すぐ外側の包み) があればコード、text・none などの無地はコードでない", () => {
    const wrapped = (language: string): string =>
      `<div class="highlight-${language} notranslate"><div class="highlight"><pre>&gt;&gt;&gt; import os\nos.sep</pre></div></div>`;
    assert.equal(htmlToMarkdown(wrapped("pycon")), "```\n>>> import os\nos.sep\n```\n");
    assert.equal(htmlToMarkdown(wrapped("text")), ">>> import os\n\nos.sep\n");
    assert.equal(htmlToMarkdown('<pre class="language-sh">make\nmake test</pre>'), "```\nmake\nmake test\n```\n");
    assert.equal(htmlToMarkdown('<pre class="lang-none">One.\nTwo.</pre>'), "One.\n\nTwo.\n");
  });

  it("言語の class が離れた外側にあるだけ、code が文の一部だけのものは、コードでない", () => {
    assert.equal(htmlToMarkdown('<div class="language-sh"><p>Run:</p><pre>One.\nTwo.</pre></div>'), "Run:\n\nOne.\n\nTwo.\n");
    assert.equal(htmlToMarkdown("<pre>Call <code>f()</code> first.\nThen stop.</pre>"), "Call f() first.\n\nThen stop.\n");
    assert.equal(htmlToMarkdown("<pre><code>a</code>\n<code>b</code></pre>"), "a\n\nb\n");
  });

  it("コードの中の # の行は見出しにならず、``` を含むコードはもっと長い囲みにする", () => {
    const html = "<h2>Setup</h2><pre><code># install\n```\nrun\n</code></pre><h2>Next</h2><p>Go.</p>";
    assert.equal(htmlToMarkdown(html), "## Setup\n\n````\n# install\n```\nrun\n````\n\n## Next\n\nGo.\n");
  });

  it("一つのページの複数の pre は、それぞれ自分の場所で自分の種類のまま", () => {
    const html = "<pre>Roses.\nViolets.</pre><p>Then:</p><pre><code>x = 1</code></pre><pre>Fin.</pre>";
    assert.equal(htmlToMarkdown(html), "Roses.\n\nViolets.\n\nThen:\n\n```\nx = 1\n```\n\nFin.\n");
  });

  it("バッククォートの多い大きなコードでも囲みの長さを数えられる", () => {
    const lines = Array.from({ length: 200_000 }, () => "`");
    assert.equal(htmlToMarkdown(`<pre><code>${lines.join("\n")}</code></pre>`), `\`\`\`\n${lines.join("\n")}\n\`\`\`\n`);
  });

  it("空の pre は何も残さない。pre の無いページはこれまでどおり", () => {
    assert.equal(htmlToMarkdown("<p>A.</p><pre>\n  \n</pre><pre><code></code></pre><p>B.</p>"), "A.\n\nB.\n");
    assert.equal(htmlToMarkdown("<p>Costs rose\n in May.</p>"), "Costs rose in May.\n");
    assert.equal(htmlToMarkdown("<p>A\u00050\u0006B\u0005C.</p>"), "A\u00050\u0006B\u0005C.\n");
  });

  it("捨てる要素 (nav・表) の中の pre は一緒に落ち、見出しの中の pre は一行の文字のまま", () => {
    assert.equal(htmlToMarkdown("<nav><pre>menu\nhome</pre></nav><table><tr><td><pre><code>x</code></pre></td></tr></table><p>Kept.</p>"), "Kept.\n");
    assert.equal(htmlToMarkdown("<h2>Step <pre>one\ntwo</pre></h2><p>Text.</p>"), "## Step one two\n\nText.\n");
    const script = '<script>show("<pre>" + text);</script><p>Kept.</p><pre>One.\nTwo.</pre>';
    assert.equal(htmlToMarkdown(script), "Kept.\n\nOne.\n\nTwo.\n");
  });
});

describe("htmlToMarkdown: ルビ", () => {
  it("ルビは親文字だけ。読みと括弧は落とす", () => {
    assert.equal(htmlToMarkdown("<p>故<ruby>漢<rp>(</rp><rt>かん</rt><rp>)</rp></ruby>字の話。</p>"), "故漢字の話。\n");
    assert.equal(htmlToMarkdown("<p><ruby>東<rt>とう</rt>京<rt>きょう</rt></ruby>駅</p>"), "東京駅\n");
    assert.equal(htmlToMarkdown("<P>故<RUBY>漢<RP>(</RP><RT>かん</RT><RP>)</RP></RUBY>字</P>"), "故漢字\n");
  });

  it("閉じタグを省いた読みと括弧は、次の rt・rp・rb か ruby の終わりまで", () => {
    assert.equal(htmlToMarkdown("<p>故<ruby>一<rp>(</rp><rt>いち</rt></ruby>議員</p>"), "故一議員\n");
    assert.equal(htmlToMarkdown("<p><ruby>一<rp>(<rt>いち<rp>)</ruby>議員</p>"), "一議員\n");
    assert.equal(htmlToMarkdown("<p><ruby>明日<rt>あした</ruby>は晴れ</p>"), "明日は晴れ\n");
    assert.equal(htmlToMarkdown("<p><ruby><rb>東<rt>とう<rb>京<rt>きょう</ruby>駅</p>"), "東京駅\n");
    assert.equal(htmlToMarkdown("<p><ruby>漢<rp>(<rt>かん</rt>字<rt>じ</rt><rp>)</rp></ruby></p>"), "漢字\n");
    assert.equal(htmlToMarkdown("<p><ruby>漢<rt>かん<rp>)</rp>字<rt>じ</rt></ruby></p>"), "漢字\n");
  });

  it("読みの入れ物 rtc は、閉じていても省いていても落とす", () => {
    assert.equal(htmlToMarkdown("<p><ruby>東京<rtc><rt>とう<rt>きょう</rtc><rtc>Tokyo</rtc></ruby>駅</p>"), "東京駅\n");
    assert.equal(htmlToMarkdown("<p><ruby><rb>東<rtc>Tokyo<rb>京</ruby>駅</p>"), "東京駅\n");
    assert.equal(htmlToMarkdown("<p><ruby>東<rtc>とう</rtc>京<rtc>きょう</rtc></ruby>駅</p>"), "東京駅\n");
    assert.equal(htmlToMarkdown("<p><ruby>東京<rtc>Tokyo</ruby>駅</p>"), "東京駅\n");
  });

  it("ルビの外の rt・rp と、ルビの無いページはそのまま", () => {
    assert.equal(htmlToMarkdown("<p>a<rt>b</rt>c<rp>(</rp>d</p>"), "abc(d\n");
    assert.equal(htmlToMarkdown("<p>読み(よみ)は括弧で書く。</p><p>次の段落。</p>"), "読み(よみ)は括弧で書く。\n\n次の段落。\n");
  });

  it("ルビが二つ並んでも、それぞれの親文字だけ", () => {
    assert.equal(htmlToMarkdown("<p>故廣瀬<ruby>隆<rp>(</rp><rt>たか</rt><rp>)</rp></ruby><ruby>一<rp>(</rp><rt>いち</rt></ruby>議員</p>"), "故廣瀬隆一議員\n");
  });
});

describe("htmlToMarkdown: 属性値の中の < と >", () => {
  it("引用符で囲んだ属性値の中のタグは、タグの終わりにならない", () => {
    const banner =
      '<section class="notice" title="This was published under the <span lang=&quot;en&quot;>2019 to 2022 government</span>">' +
      '<p>This was published under the <span lang="en">2019 to 2022 government</span></p></section>';
    assert.equal(htmlToMarkdown(banner), "This was published under the 2019 to 2022 government\n");
    assert.equal(htmlToMarkdown("<p title='1 > 0'>Kept.</p><p data-rule=\"a<b\">Also kept.</p>"), "Kept.\n\nAlso kept.\n");
    assert.equal(htmlToMarkdown('<p title = "1 > 0">Kept.</p><p title="a <li b">Also kept.</p>'), "Kept.\n\nAlso kept.\n");
  });

  it("属性値の > の先も読む: 画像の代替テキストと見出しの id", () => {
    const image = '<html><head><title>A &gt; B</title></head><body><h1><img alt="A > B" src="a.png"></h1><p>Text.</p></body></html>';
    assert.equal(htmlToMarkdown(image), "# A > B\n\nText.\n");
    assert.equal(htmlToMarkdown('<h2 id="a>b">Scope <a href="#a&gt;b">¶</a></h2><p>Text.</p>'), "## Scope\n\nText.\n");
  });

  it("= の後でない引用符はただの文字。閉じない引用符のタグはこれまでどおり", () => {
    assert.equal(htmlToMarkdown('<p class=it\'s>One.</p><p>Two "quoted".</p>'), 'One.\n\nTwo "quoted".\n');
    assert.equal(htmlToMarkdown('<p>A.</p><p title="oops>B.</p>'), "A.\n\nB.\n");
  });

  it("閉じないタグに引用符の値がいくつ並んでも、読み終わる", () => {
    const unclosed = `<p${' a="x"'.repeat(40)}`;
    assert.equal(htmlToMarkdown(`<p>A.</p>${unclosed}`), `A.\n\n${unclosed}\n`);
  });

  it("script と style の中身はタグとして読まない", () => {
    assert.equal(htmlToMarkdown('<script>s = \'<b title="\';</script><p>Kept.</p><p title="x">Also.</p>'), "Kept.\n\nAlso.\n");
    assert.equal(htmlToMarkdown("<style>a[title='<b']{}</style><p>Kept.</p><p title='x'>Also.</p>"), "Kept.\n\nAlso.\n");
  });
});

describe("decodeEntities", () => {
  it("一度だけ戻す。知らない名前や範囲外の番号は書かれたまま", () => {
    assert.equal(decodeEntities("&amp;lt; &unknown; &#0; &#x110000; &nbsp;&rsquo;"), "&lt; &unknown; &#0; &#x110000;  ’");
  });

  it("HTML の標準の名前はすべて戻す。数字を含む名前も", () => {
    assert.equal(decodeEntities("Vissing-J&oslash;rgensen, 2,088&divide;814,793, &frac12;, m&sup2;, &Dagger;"), "Vissing-Jørgensen, 2,088÷814,793, ½, m², ‡");
  });

  it("名前の大文字と小文字は区別する", () => {
    assert.equal(decodeEntities("&Oslash;&oslash; &AMP; &NBSP; &Divide;"), "Øø & &NBSP; &Divide;");
  });

  it("名前付きの空白は普通の空白。番号で書いた空白と見えない文字はそのまま", () => {
    assert.equal(decodeEntities("a&nbsp;b&thinsp;c&ensp;d&ThickSpace;e"), "a b c d e");
    assert.equal(decodeEntities("a&#160;b&zwj;c"), "a b‍c");
  });

  it("オブジェクトの持つ名前 (constructor など) は参照でない", () => {
    assert.equal(decodeEntities("&constructor; &toString; &hasOwnProperty; &valueOf;"), "&constructor; &toString; &hasOwnProperty; &valueOf;");
  });
});
