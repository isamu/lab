// The home page's text in both languages. Both have the same shape, so a section added to one is a type error until the
// other has it too. A `code` span is written between backticks.
// The site's languages, as i18n.ts names them; written here too so the tests can import this file without Astro.
type Lang = "ja" | "en";

/** A point: a short title and a sentence or two under it. */
export type Point = { readonly title: string; readonly body: string };
/** A command beyond the plain check, with the guide page that explains it. */
export type Tool = { readonly command: string; readonly body: string; readonly guide: string };
/** Another tool a reader may know: what its own site says it is, and how chaff differs. */
export type Comparison = { readonly name: string; readonly url: string; readonly theirs: string; readonly chaff: string };

export type HomeText = {
  readonly documentTitle: string;
  readonly description: string;
  readonly lede: string;
  readonly audience: string;
  readonly needs: string;
  readonly sourceLink: string;
  readonly examplesHeading: string;
  readonly examplesNote: string;
  readonly contractHeading: string;
  readonly contractIntro: string;
  readonly draftHeading: string;
  readonly draftIntro: string;
  readonly rewriteIntro: string;
  readonly teamHeading: string;
  readonly teamIntro: string;
  readonly showDocument: string;
  readonly showRewrite: string;
  readonly differentHeading: string;
  readonly different: readonly Point[];
  readonly neverRewritesHeading: string;
  readonly neverRewrites: readonly string[];
  readonly privacyHeading: string;
  readonly privacy: readonly string[];
  readonly toolsHeading: string;
  readonly toolsIntro: string;
  readonly tools: readonly Tool[];
  readonly compareHeading: string;
  readonly compareIntro: string;
  readonly compareTheirs: string;
  readonly compareChaff: string;
  readonly compare: readonly Comparison[];
  readonly limitsHeading: string;
  readonly limits: readonly Point[];
  readonly measuredHeading: string;
  readonly measured: readonly string[];
  readonly plantedLink: string;
  readonly corpusLink: string;
  readonly reportHeading: string;
  readonly report: string;
  readonly sourceHeading: string;
  readonly license: string;
  readonly maker: string;
  readonly readMore: string;
};

const en: HomeText = {
  documentTitle: "chaff: a linter for contracts, reports and docs, in English and Japanese",
  description:
    "chaff checks documents for what a machine can check: sentences too long to follow, totals that do not add up, dates out of order, references to clauses that are not there. Same text, same result. It never rewrites the text.",
  lede: "A linter for documents. chaff checks contracts, reports, manuals and blog posts for what a machine can check: sentences too long to follow, totals that do not add up, dates out of order, references to clauses that are not there. It never rewrites the text.",
  audience:
    "For people who write or review documents in English or Japanese, and for teams that have an AI draft them and want its mistakes caught by a machine, not by another AI's opinion.",
  needs: "Node.js 24 or later. Nothing to install first, no config file, no API key.",
  sourceLink: "Source on GitHub",
  examplesHeading: "What it prints",
  examplesNote:
    "The documents below were written for this page. The output under each is chaff's, run on that document when this site was built; none of it is typed by hand.",
  contractHeading: "A contract that contradicts itself",
  contractIntro:
    "A period that ends before it starts, a total that is not the sum of its items, a weekday that does not match its date, and a reference to an article that is not there. Each is decided by arithmetic or by the document's own structure, so a machine can say it every time.",
  draftHeading: "Text that sounds generated, and a rewrite",
  draftIntro:
    "A draft written to sound like generated text. chaff names the stock phrases and the sections with nothing concrete in them. It does not say whether an AI wrote it.",
  rewriteIntro: "The same topic, rewritten by hand with numbers and decisions in it. chaff did not write this; it only checked it.",
  teamHeading: "Your team's own words",
  teamIntro:
    "Jargon, required sections and preferred spellings come from the team's chaff.yaml. chaff ships none of its own: what counts as jargon differs from one team to the next.",
  showDocument: "The document",
  showRewrite: "The rewrite",
  differentHeading: "What is different about it",
  different: [
    {
      title: "Same text, same result",
      body: "There is no model in the lint path. With the same version and settings, the same text gives the same findings every time, so a run in CI means the same as a run on your laptop.",
    },
    {
      title: "It checks a document against itself",
      body: "Totals against their items, the start and end of a period, a weekday against its date, a number or a name written two ways, references to articles that are not there, gaps in the numbering, a term defined twice.",
    },
    {
      title: "It says what it did not check",
      body: "Every rule that did not run is listed with its reason (wrong language, not used for this genre, needs `chaff test`). 0 findings never has to be read as 'nothing was checked'.",
    },
    {
      title: "Rules fit the kind of document",
      body: "A contract's sentences run longer than a blog's. Pick a genre with `--genre` and the rules and limits fit that kind, with nothing to configure.",
    },
    {
      title: "Japanese and English, fully",
      body: "Every rule, message and screen exists in both languages. The language is read from the text.",
    },
    {
      title: "Meaning goes to an AI only when you ask",
      body: "What only reading can decide (does the conclusion say anything?) runs with `npx chaffjs test`. The machine narrows it to the passages that need a judge and shows what it will send before it sends it.",
    },
  ],
  neverRewritesHeading: "Why it never rewrites",
  neverRewrites: [
    "A tool that tells you a text looks generated gives you nothing to act on. A tool that rewrites the text for you takes the author out of their own document, and a rewrite can drop a number or move a date without anyone noticing.",
    "chaff reports, and the person who wrote the text decides what to change, or the AI they asked, working from a plan they can read (`fix-plan`). Each report ends by saying the text was not changed.",
  ],
  privacyHeading: "Does it send my text anywhere?",
  privacy: [
    "No. The check runs on your machine, or inside the page in the playground, and sends nothing.",
    "Only `npx chaffjs test` calls an AI API (Anthropic or OpenAI, with your own key). It sends only the passages the machine picked out, and `--dry-run` shows them without calling the API. `feedback` writes a draft report to a file and sends nothing itself.",
  ],
  toolsHeading: "More than the lint",
  toolsIntro: "Every command returns an exit code, so each one can run in CI.",
  tools: [
    {
      command: "npx chaffjs compare before.md after.md",
      body: "Checks that a rewrite dropped no fact and added none: numbers, dates, URLs, code, names, quotations.",
      guide: "commands",
    },
    {
      command: "npx chaffjs cite source.md quotes.json",
      body: "Checks that each quoted passage really is in its source.",
      guide: "structure",
    },
    {
      command: "npx chaffjs ai-score article.md",
      body: "A quick AI-likeness reading, low, medium or high, from signs of generated text that human documents of the genre rarely show. It is not a verdict on whether an AI wrote it.",
      guide: "ai-sounding",
    },
    {
      command: "npx chaffjs grade outputs.jsonl",
      body: "Grades a file of model outputs against the rules, compare and cite: a deterministic layer in an eval suite. It sends nothing.",
      guide: "ai-evals",
    },
    {
      command: "npx chaffjs fix-plan article.md",
      body: "A plan for whoever rewrites the file, a person or an AI: the findings by rule, how to rewrite each, and the checks to run after.",
      guide: "commands",
    },
    {
      command: "npx chaffjs . --sarif out.sarif",
      body: "In CI: findings on the lines of a pull request, and `baseline` shelves today's findings so only new ones fail the build.",
      guide: "ci",
    },
  ],
  compareHeading: "How it compares",
  compareIntro:
    "What the other tools are is quoted from their own sites. They are good at what they do, and several can be used beside chaff. The differences below are what chaff does, not claims about what the others lack.",
  compareTheirs: "What it is",
  compareChaff: "Where chaff differs",
  compare: [
    {
      name: "Vale",
      url: "https://vale.sh/",
      theirs: "An open-source (MIT), markup-aware linter for prose. Teams write their style guide as YAML rules.",
      chaff:
        "Ships its rules, chosen by the kind of document, and checks a document's own numbers, dates and references. Reads Japanese as well as English.",
    },
    {
      name: "textlint",
      url: "https://textlint.org/",
      theirs: "An open-source, pluggable linter for natural language, written in JavaScript. Rules are installed separately from npm.",
      chaff: "Comes with its rules built in and set per genre. A team's own rules go in chaff.yaml or a YAML rule pack.",
    },
    {
      name: "LanguageTool",
      url: "https://languagetool.org/",
      theirs:
        "Open-source proofreading (LGPL) for more than 25 languages, finding errors a spell checker cannot. It can run as your own server.",
      chaff: "Not a grammar or spelling checker, and reads only English and Japanese. It checks structure, consistency and arithmetic.",
    },
    {
      name: "Grammarly",
      url: "https://www.grammarly.com/",
      theirs: "An AI writing assistant that suggests edits and paragraph rewrites, in the browser, desktop and office apps.",
      chaff: "Never rewrites, runs on your machine or in CI, and gives the same result for the same text.",
    },
    {
      name: "Asking an LLM",
      url: "",
      theirs: "A prompt such as 'review this contract'. It reads meaning and can notice what no rule covers.",
      chaff:
        "The same input does not always give the same answer, and a missed total is hard to notice. chaff's checks repeat exactly and cost nothing to run on every change. The two work together: `chaff test` hands an AI only the passages that need reading.",
    },
  ],
  limitsHeading: "What it does not do",
  limits: [
    {
      title: "It does not judge meaning",
      body: "Whether an argument holds, a fact is true or a contract is fair is not for a linter. chaff stops at narrowing the question (`chaff test`).",
    },
    {
      title: "It misses things",
      body: "It finds only what a rule covers, and only the phrasings that rule knows. 0 findings means none of the rules that ran found anything.",
    },
    {
      title: "It is wrong sometimes",
      body: 'Silence one spot with `<!-- stet: rule-id — reason -->`, relax a rule for the team with `npx chaffjs relax rule-id --why "reason"`, or turn it off in chaff.yaml.',
    },
  ],
  measuredHeading: "How it is measured",
  measured: [
    "Planted sets: self-written documents of one genre (contracts, email, reports, technical writing and more), each in a clean version and a version with mistakes planted. Every change counts which planted mistakes are reported on their line and which findings the clean versions get, and CI fails when either gets worse.",
    "A corpus of real documents, public-domain statutes among them, is re-run on every change, so a new rule that starts flagging ordinary writing shows up before it ships.",
  ],
  plantedLink: "The planted sets and their recorded results",
  corpusLink: "The corpus and its expected results",
  reportHeading: "When a finding is wrong",
  report:
    "`npx chaffjs feedback <file> --rule <rule>` drafts a report with only the lines around the finding, and prints the command to open a GitHub issue with it. It sends nothing itself. Each report becomes a test and a fix.",
  sourceHeading: "Source and license",
  license: "MIT license",
  maker: "Made by isamu, in the isamu/lab repository.",
  readMore: "Read more",
};

const ja: HomeText = {
  documentTitle: "chaff: 契約書・報告書・文書の linter（日本語と英語）",
  description:
    "chaff は、機械で確かめられることを文書の中で見つけます。長すぎる文、合わない合計、順序の逆な日付、無い条項への参照。同じ文章なら同じ結果を出し、文章は書き換えません。",
  lede: "文書の linter です。契約書・報告書・マニュアル・ブログ記事の中で、機械で確かめられることを見つけます。読み切れないほど長い文、内訳と合わない合計、終わりが始まりより前の期間、無い条項への参照。文章は書き換えません。",
  audience:
    "日本語や英語の文書を書く人・確かめる人のための道具です。AI に下書きさせているチームが、その間違いを別の AI の意見ではなく機械で捕まえるためにも使えます。",
  needs: "Node.js 24 以上が要ります。先に入れるものも、設定ファイルも、API キーも要りません。",
  sourceLink: "GitHub のソース",
  examplesHeading: "出力の例",
  examplesNote:
    "下の文書はこのページのために書いたものです。その下の出力は、このサイトを作るときにその文書へ chaff をかけた結果で、手で書いたものはありません。",
  contractHeading: "自分と食い違う契約書",
  contractIntro:
    "終わりが始まりより前の期間、内訳の和と合わない合計、日付と合わない曜日、無い条への参照。どれも計算か文書自身の構造で決まるので、機械が毎回同じように言えます。",
  draftHeading: "AI が書いたような文章と、その書き直し",
  draftIntro:
    "生成した文章のように書いた下書きです。chaff は、決まり文句の書き出しや締め、中身を言わない強調を挙げます。AI が書いたかどうかは判定しません。",
  rewriteIntro: "同じ話題を、数字と決めたことを入れて手で書き直したものです。chaff は書き直していません。確かめただけです。",
  teamHeading: "チームの言葉",
  teamIntro:
    "社内用語、必ず要る見出し、表記の揃え方は、チームの chaff.yaml から読みます。chaff は自分では持っていません。何が社内用語かはチームごとに違うからです。",
  showDocument: "文書",
  showRewrite: "書き直した文書",
  differentHeading: "ほかの道具と違うところ",
  different: [
    {
      title: "同じ文章なら同じ結果",
      body: "lint の道筋にモデルは入っていません。版と設定が同じなら、同じ文章からは毎回同じ指摘が出ます。CI での結果と手元での結果は同じ意味です。",
    },
    {
      title: "文書を文書自身と突き合わせる",
      body: "合計と内訳、期間の始まりと終わり、日付と曜日、二通りに書かれた数字や名前、無い条への参照、番号の抜け、二度定義された用語。",
    },
    {
      title: "確かめなかったことを言う",
      body: "動かなかったルールを、理由（言語が違う、このジャンルでは見ない、`chaff test` が要る）と一緒にすべて並べます。指摘 0 件が「何も見ていない」と読まれることはありません。",
    },
    {
      title: "文書の種類に合わせる",
      body: "契約書の文はブログより長くなるものです。`--genre` でジャンルを選ぶと、ルールと閾値がその種類に合います。設定は要りません。",
    },
    {
      title: "日本語と英語の両方で、全部",
      body: "ルールも、メッセージも、画面も、両方の言語にあります。言語は文章から決めます。",
    },
    {
      title: "意味を読むのは、頼んだときだけ AI に",
      body: "読まないと決まらないこと（結論が何かを言っているか）は `npx chaffjs test` で見ます。判断の要る箇所を機械が先に絞り、送る前に何を送るかを見せます。",
    },
  ],
  neverRewritesHeading: "なぜ書き換えないのか",
  neverRewrites: [
    "「AI が書いたように見える」と言うだけの道具では、何を直せばよいかがわかりません。代わりに書き換える道具は、書いた人を自分の文書から外してしまいます。それに、書き換えで数字が落ちたり日付がずれたりしても、誰も気づきません。",
    "chaff は報告するだけです。何を変えるかは書いた人が決めます。AI に頼むなら、読める計画（`fix-plan`）を渡して直させます。報告の最後には、文章を変えていないことが書いてあります。",
  ],
  privacyHeading: "文章はどこかへ送られますか",
  privacy: [
    "送られません。確かめるのは手元のマシンの中、プレイグラウンドならそのページの中で、何も送りません。",
    "AI の API を呼ぶのは `npx chaffjs test` だけです（Anthropic か OpenAI、自分のキーで）。送るのは機械が選んだ箇所だけで、`--dry-run` を付けると API を呼ばずにそれを見せます。`feedback` は報告の下書きをファイルに書くだけで、自分では何も送りません。",
  ],
  toolsHeading: "lint のほかにできること",
  toolsIntro: "どのコマンドも終了コードを返すので、CI で回せます。",
  tools: [
    {
      command: "npx chaffjs compare 元.md 書き直し.md",
      body: "書き換えで事実が落ちていないか、増えていないかを確かめます。数字、日付、URL、コード、名前、引用。",
      guide: "commands",
    },
    { command: "npx chaffjs cite 出典.md quotes.json", body: "引用した文が、本当にその出典にあるかを確かめます。", guide: "structure" },
    {
      command: "npx chaffjs ai-score 記事.md",
      body: "AI らしさを低・中・高で簡易に判定します。生成した文章に多く、同じジャンルの人の文書には少ない印を数えます。AI が書いたかどうかの判定ではありません。",
      guide: "ai-sounding",
    },
    {
      command: "npx chaffjs grade outputs.jsonl",
      body: "モデルの出力を並べたファイルを、ルールと compare と cite で採点します。評価の仕組みの中で、決まった結果を出す層になります。何も送りません。",
      guide: "ai-evals",
    },
    {
      command: "npx chaffjs fix-plan 記事.md",
      body: "書き直す人（人でも AI でも）に渡す計画です。ルールごとの指摘、それぞれの直し方、直した後にかける検査を並べます。",
      guide: "commands",
    },
    {
      command: "npx chaffjs . --sarif out.sarif",
      body: "CI で、指摘を pull request の行に出します。`baseline` でいまある指摘を棚上げすれば、新しい指摘だけがビルドを落とします。",
      guide: "ci",
    },
  ],
  compareHeading: "ほかの道具との比べ方",
  compareIntro:
    "ほかの道具が何かは、それぞれのサイトの説明から引いています。どれもそれぞれの仕事が得意で、chaff と並べて使えるものもあります。下の違いは chaff がすることで、ほかの道具に何かが欠けているという話ではありません。",
  compareTheirs: "どういう道具か",
  compareChaff: "chaff の違い",
  compare: [
    {
      name: "Vale",
      url: "https://vale.sh/",
      theirs: "オープンソース（MIT）で、マークアップを読む文章の linter。チームのスタイルガイドを YAML のルールで書きます。",
      chaff: "ルールを同梱し、文書の種類で選びます。文書の中の数字・日付・参照を突き合わせます。英語に加えて日本語も読みます。",
    },
    {
      name: "textlint",
      url: "https://textlint.org/",
      theirs: "JavaScript で書かれた、オープンソースでプラグイン式の自然言語の linter。ルールは npm から別に入れます。",
      chaff: "ルールが最初から入っていて、ジャンルごとに決まります。チーム独自のルールは chaff.yaml か YAML のルール集に書きます。",
    },
    {
      name: "LanguageTool",
      url: "https://languagetool.org/",
      theirs:
        "25 を超える言語のための、オープンソース（LGPL）の校正ツール。スペルチェッカーでは見つからない誤りを見つけます。自分のサーバーでも動かせます。",
      chaff: "文法やつづりの検査器ではなく、読むのは日本語と英語だけです。構造・一貫性・計算を確かめます。",
    },
    {
      name: "Grammarly",
      url: "https://www.grammarly.com/",
      theirs: "直し方や段落の書き直しを提案する AI の文章アシスタント。ブラウザ、デスクトップ、オフィスのアプリで動きます。",
      chaff: "書き換えません。手元か CI で動き、同じ文章には同じ結果を出します。",
    },
    {
      name: "LLM に頼む",
      url: "",
      theirs: "「この契約書を確認して」のようなプロンプト。意味を読み、どのルールにもないことにも気づけます。",
      chaff:
        "同じ入力でも同じ答えが返るとは限らず、見落とした合計には気づきにくいものです。chaff の検査はそのまま繰り返せて、変更のたびにかけても費用がかかりません。両方を組み合わせられます。`chaff test` は、読む必要のある箇所だけを AI に渡します。",
    },
  ],
  limitsHeading: "しないこと",
  limits: [
    {
      title: "意味は判断しない",
      body: "論が通っているか、事実が正しいか、契約が公平かは、linter の仕事ではありません。chaff は問いを絞るところまでです（`chaff test`）。",
    },
    {
      title: "見逃す",
      body: "見つけるのは、ルールがあることと、そのルールが知っている書き方だけです。指摘 0 件は、動いたルールが何も見つけなかったという意味です。",
    },
    {
      title: "間違える",
      body: '一か所だけ黙らせるなら `<!-- stet: rule-id — 理由 -->`、チームでゆるめるなら `npx chaffjs relax rule-id --why "理由"`、止めるなら chaff.yaml に書きます。',
    },
  ],
  measuredHeading: "どう測っているか",
  measured: [
    "誤りを仕込んだ文書の組: ジャンルごとに自分たちで書いた文書（契約書、メール、報告書、技術文書など）を、誤りのない版と誤りを仕込んだ版の二つで持っています。変更のたびに、仕込んだ誤りのうちその行で指摘できたものと、誤りのない版に出た指摘を数え、どちらかが悪くなると CI が落ちます。",
    "パブリックドメインの法令を含む実際の文書（corpus）にも変更のたびにかけ直します。新しいルールがふつうの文章を指摘し始めたら、出す前にわかります。",
  ],
  plantedLink: "誤りを仕込んだ文書の組と、記録した結果",
  corpusLink: "corpus と、その期待値",
  reportHeading: "指摘が間違っていたら",
  report:
    "`npx chaffjs feedback <ファイル> --rule <ルール>` が、指摘の前後の行だけを入れた報告の下書きを作り、GitHub の issue にするコマンドを出します。自分では何も送りません。報告の一つ一つが、試験と修正になります。",
  sourceHeading: "ソースとライセンス",
  license: "MIT ライセンス",
  maker: "作者は isamu で、isamu/lab リポジトリにあります。",
  readMore: "詳しく",
};

export const HOME_TEXT: Readonly<Record<Lang, HomeText>> = { en, ja };

/** One run of a text: plain, or a `code` span. */
export type Segment = { readonly text: string; readonly code: boolean };

/** Pure: a text split at its backticks, the odd parts being code. An unpaired backtick is kept as written. */
export const segmentsOf = (text: string): Segment[] => {
  const parts = text.split("`");
  if (parts.length % 2 === 0) return [{ text, code: false }];
  return parts.map((part, index) => ({ text: part, code: index % 2 === 1 })).filter((segment) => segment.text !== "");
};
