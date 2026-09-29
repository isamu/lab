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
    assert.equal(htmlToMarkdown(`<div><p class="logo">省の名前</p>${labelled}</div>${title}`), "# 意見の募集について\n\n本文。\n");
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
    const due = (mark: string): string => `<div><p>Comments are due by May 1${mark}</p>${menu}</div>${title}`;
    assert.equal(htmlToMarkdown(due(".")), "Comments are due by May 1.\n\n# AGENCY:\n\nText.\n");
    assert.equal(htmlToMarkdown(due("?")), "Comments are due by May 1?\n\n# AGENCY:\n\nText.\n");
    assert.equal(
      htmlToMarkdown(`<div><div><p>募集は5月1日までです。</p></div><div><p>標語</p>${menu}</div></div>${title}`),
      "募集は5月1日までです。\n\n# AGENCY:\n\nText.\n",
    );
    assert.equal(
      htmlToMarkdown(`<dl><dt>Want to comment?</dt><dd><a href="/c">Comment form</a></dd></dl>${title}`),
      "Want to comment?\n\nComment form\n\n# AGENCY:\n\nText.\n",
    );
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

describe("decodeEntities", () => {
  it("一度だけ戻す。知らない名前や範囲外の番号は書かれたまま", () => {
    assert.equal(decodeEntities("&amp;lt; &unknown; &#0; &#x110000; &nbsp;&rsquo;"), "&lt; &unknown; &#0; &#x110000;  ’");
  });
});
