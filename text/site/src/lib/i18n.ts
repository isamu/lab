import { groupTextOf, type GroupText, type RuleGroup } from "../../../packages/chaff/src/rule-guide.ts";

export type Lang = "ja" | "en";
export const LANGS: readonly Lang[] = ["ja", "en"];

export const isLang = (value: unknown): value is Lang => value === "ja" || value === "en";

export const otherLang = (lang: Lang): Lang => (lang === "ja" ? "en" : "ja");

const ja = {
  siteTitle: "chaff",
  tagline: "文章の読みにくいところを見つける道具。文章は書き換えない。",
  rules: "ルール",
  genres: "ジャンル",
  pickGenre: "文書の種類を選ぶ（ジャンルの一覧）",
  tryInBrowser: "何も入れずに、ブラウザで試す",
  genresIntro:
    "文書の種類（ジャンル）を選ぶと、ルールと閾値をその種類に合わせて見ます。契約書なら、一文の長さの上限を法務の文書に合わせ、条項の番号の抜けや無い条項への参照も見ます。設定は要りません。",
  genresSuggest:
    "ジャンルを決めていない文書は、技術ブログ（blog/tech）として見ます。別の種類に見えるときは、画面がそう言って、試すジャンルを挙げます。",
  genreProfile: "この種類の書き方の知識で読む:",
  genreTurnsOn: "既定で動かす試験中のルール:",
  genreTurnsOff: "この種類では見ないルール",
  genreAsDefault: "このジャンルで止めるルールはありません。",
  genresSource: "このページは chaff に同梱したジャンルの定義（genres.yaml）から作られています",
  guide: "手引き",
  startGuide: "はじめかたを読む",
  ruleCount: "件のルール",
  layer: "層",
  status: "状態",
  severity: "重さ",
  languages: "対象の言語",
  allLanguages: "日本語と英語",
  levels: "段階",
  levelsSetSeverity: "このルールには数える上限がありません。段階は指摘の重さを変えます。relaxed にすると指摘は消えずに一段軽く出ます。",
  usedFor: "向いている文章",
  why: "なぜ指摘するのか",
  message: "指摘の文",
  howToFix: "直し方",
  rewriteDepth: "書き直しの深さ（chaff fix-plan --depth）",
  sources: "根拠にした文献",
  stable: "安定",
  experimental: "試験中",
  deprecated: "廃止予定",
  experimentalNote:
    "ほとんどのルールは既定で動きます。「既定で動く（情報）」のルールは、指摘を情報として出し、実行を失敗にしません。試験中のルール（まだ測っていない新しいルール）は、chaff.yaml の rules: に名前を書くか、--experimental を付けると動きます。",
  source: "このページはルールの定義ファイルから作られています",
  switchTo: "English",
  backToRules: "ルールの一覧へ",
  error: "エラー",
  warning: "注意",
  info: "情報",
  refContents: "グループ",
  runsDefault: "既定で動く",
  runsInfo: "既定で動く（情報）",
  runsExperimental: "試験中",
  runsTeam: "chaff.yaml に書いたとき",
  runsStyle: "chaff.yaml の style で",
  runsTest: "chaff test",
  langJa: "日本語",
  langEn: "英語",
  exampleLabel: "例",
  outputLabel: "chaff の出力",
  testOutput: "この検査は機械では決めません。npx chaffjs test で、AI がこの箇所を読みます。",
  configLabel: "この例で使った chaff.yaml",
  otherFileLabel: "一緒に渡したファイル（a.md）。指摘される文と直した文は、それぞれこのファイルと比べます",
  paddedNote:
    "文書全体の割合を見るルールなので、この例の後ろに指摘のない普通の文章（日本語で 500 字、英語で 200 語ほど）を足して試しています。",
  ruleDetails: "詳しく",
  exampleHeading: "例",
  beforeLabel: "指摘される文",
  afterLabel: "直した文",
  noFinding: "指摘なし",
  notFlagged: "指摘しないもの",
  levelsPlain: "強さ（段階）",
  levelsIntro:
    "chaff.yaml の rules にこの名前と段階を書くと変わります。書かなければ、ジャンルが決めた段階で動きます（どのジャンルで動くかは下の「ジャンルごとの動き」にあります）。",
  levelsSame: "どの段階でも同じように見ます。見ないときは off にします。",
  levelsSeverity: "意味を読む検査の段階は、指摘の重さを表します。",
  ownNumbers: "次のジャンルは、段階に別の数字を持っています（npx chaffjs explain で確かめられます）:",
  byGenre: "ジャンルごとの動き",
  genreOn: "既定で動くジャンル",
  genreExperimental: "試験中なので、--experimental か chaff.yaml で動かすジャンル",
  genreOptIn: "chaff.yaml の style（か rules）で動かすジャンル",
  genreOff: "このルールを止めるジャンル",
  genreUnsuited: "このルールが向かず、見ないジャンル",
  silenceHeading: "止める・ゆるめる",
  silenceSpot: "この一か所だけ黙らせる（文書に書く）",
  silenceTeam: "チームでゆるめる（理由は chaff.yaml にコメントで残ります）",
  silenceOff: "チームで止める（chaff.yaml）",
  turnOn: "試験中のこのルールを動かす（chaff.yaml）",
  technical: "技術的な情報",
  requires: "文書から読み取るもの",
  rulesIntro:
    "chaff が文書の中で見つけるものを、何に役立つかで分けて並べています。名前を押すと、指摘される文と直した文、指摘しないもの、止め方が読めます。",
  teaserMessage: "指摘の例",
  teaserExcerpt: "AI に読ませる文の例",
  referenceLink: "例と実際の出力つきの一覧（リファレンス）",
  playground: "試す",
  playgroundIntro:
    "見本を選ぶか、自分の文章を貼って「チェックする」を押します。chaff はこのページの中で動き、書いたものはブラウザの外へ出ません。",
  playgroundLoads:
    "このページが読み込むのは chaff のコードと規則、それに日本語を初めて確かめるときの辞書だけです。辞書は大きいので、最初の一回は少し待ちます。",
  playgroundText: "文章",
  playgroundLanguage: "言語",
  playgroundAuto: "文章から決める",
  playgroundGenre: "ジャンル",
  playgroundGenreDefault: "決めない（技術ブログとして読む）",
  playgroundCheck: "チェックする",
  playgroundSample: "見本",
  playgroundChecking: "確かめています…",
  playgroundFindings: "指摘 {n} 件",
  playgroundNoFindings: "指摘はありません。動かなかった rule は下に並べています。",
  playgroundNotRun: "動かなかった rule（{n} 件）",
  playgroundLine: "{n} 行目",
  playgroundError: "確かめられませんでした: {message}",
  playgroundCli: "同じ結果を手元で出すには: npx chaffjs --genre <ジャンル> <ファイル>",
};

export type UiKey = keyof typeof ja;

const en: Record<UiKey, string> = {
  siteTitle: "chaff",
  tagline: "Finds what makes writing hard to read. It never rewrites the text.",
  rules: "Rules",
  genres: "Genres",
  pickGenre: "Pick the kind of document (the genres)",
  tryInBrowser: "Try it in your browser, with nothing to install",
  genresIntro:
    "Pick the kind of document (the genre) and chaff sets its rules and limits to that kind. A contract gets sentence limits fit for legal writing, and its clause numbering and references to clauses are checked too. No settings needed.",
  genresSuggest:
    "A document with no genre set is checked as a tech blog post (blog/tech). When it looks like another kind, the screen says so and names the genre to try.",
  genreProfile: "Reads with the knowledge of this kind of document:",
  genreTurnsOn: "Experimental rules it turns on:",
  genreTurnsOff: "Rules this kind is not checked with",
  genreAsDefault: "This genre turns no rule off.",
  genresSource: "This page is built from the genre definitions shipped with chaff (genres.yaml)",
  guide: "Guide",
  startGuide: "Get started",
  ruleCount: "rules",
  layer: "Layer",
  status: "Status",
  severity: "Severity",
  languages: "Languages",
  allLanguages: "Japanese and English",
  levels: "Levels",
  levelsSetSeverity:
    "This rule has no limit to count to. A level sets how a finding is marked: relaxed keeps the finding and marks it a step lower.",
  usedFor: "Suited to",
  why: "Why it matters",
  message: "Message",
  howToFix: "How to fix",
  rewriteDepth: "Rewrite depth (chaff fix-plan --depth)",
  sources: "Sources",
  stable: "stable",
  experimental: "experimental",
  deprecated: "deprecated",
  experimentalNote:
    "Most rules run by default. A rule marked on by default (info) reports as information and never fails the run. Experimental rules (new ones not measured yet) are off: name one under rules: in chaff.yaml, or pass --experimental.",
  source: "This page is built from the rule's definition file",
  switchTo: "日本語",
  backToRules: "All rules",
  error: "error",
  warning: "warning",
  info: "info",
  refContents: "Groups",
  runsDefault: "on by default",
  runsInfo: "on by default (info)",
  runsExperimental: "experimental",
  runsTeam: "when listed in chaff.yaml",
  runsStyle: "with a style in chaff.yaml",
  runsTest: "chaff test",
  langJa: "Japanese",
  langEn: "English",
  exampleLabel: "Example",
  outputLabel: "What chaff prints",
  testOutput: "No machine decides this one. npx chaffjs test has an AI read the passage.",
  configLabel: "chaff.yaml used for this example",
  otherFileLabel: "The file checked together with it (a.md). The flagged and the fixed text are each compared with it",
  paddedNote:
    "The rule measures the whole document, so this example was tried with an ordinary passage (about 200 words) after it that gives chaff nothing to report.",
  ruleDetails: "Details",
  exampleHeading: "Example",
  beforeLabel: "Flagged",
  afterLabel: "Fixed",
  noFinding: "no finding",
  notFlagged: "What it does not flag",
  levelsPlain: "Levels",
  levelsIntro:
    "Set a level for this rule under rules in chaff.yaml. With nothing set, it runs at the level its genre gives it (see By genre below).",
  levelsSame: "Every level checks the same way. Use off to turn it off.",
  levelsSeverity: "For a check that reads meaning, the level is how serious a finding is.",
  ownNumbers: "These genres set their own numbers for the levels (npx chaffjs explain shows them):",
  byGenre: "By genre",
  genreOn: "Runs by default in",
  genreExperimental: "Experimental, so it runs with --experimental or a level in chaff.yaml, in",
  genreOptIn: "Runs with a style (or a level) in chaff.yaml, in",
  genreOff: "Turned off by the genre in",
  genreUnsuited: "Not suited to, and not run in",
  silenceHeading: "Turning it off or relaxing it",
  silenceSpot: "Silence this one spot (in the document)",
  silenceTeam: "Relax it for the team (the reason is kept as a comment in chaff.yaml)",
  silenceOff: "Turn it off for the team (chaff.yaml)",
  turnOn: "Turn this experimental rule on (chaff.yaml)",
  technical: "Technical details",
  requires: "Reads from the document",
  rulesIntro:
    "What chaff finds in a document, grouped by what it helps with. Open a rule to see a text it flags and the same text fixed, what it leaves alone, and how to turn it off.",
  teaserMessage: "For example",
  teaserExcerpt: "Text an AI reads, for example",
  referenceLink: "The list with examples and real output (Reference)",
  playground: "Try it",
  playgroundIntro:
    "Pick a sample or paste your own text, then press Check. chaff runs inside this page: what you write never leaves your browser.",
  playgroundLoads:
    "The page loads only chaff's code and rules, and, the first time you check Japanese, its dictionary. The dictionary is large, so that first check takes a moment.",
  playgroundText: "Text",
  playgroundLanguage: "Language",
  playgroundAuto: "From the text",
  playgroundGenre: "Genre",
  playgroundGenreDefault: "None (read as a tech blog)",
  playgroundCheck: "Check",
  playgroundSample: "Sample",
  playgroundChecking: "Checking…",
  playgroundFindings: "Findings: {n}",
  playgroundNoFindings: "No findings. The rules that did not run are listed below.",
  playgroundNotRun: "Rules that did not run ({n})",
  playgroundLine: "Line {n}",
  playgroundError: "Could not check: {message}",
  playgroundCli: "The same result on your machine: npx chaffjs --genre <genre> <file>",
};

const UI: Record<Lang, Record<UiKey, string>> = { ja, en };

export const t = (lang: Lang, key: UiKey): string => UI[lang][key];

const isUiKey = (value: string): value is UiKey => value in ja;

/** A word from the rule files (a severity such as "warning") in the page's language, or as written when there is none. */
export const term = (lang: Lang, word: string): string => (isUiKey(word) ? t(lang, word) : word);

/** A path under the site, with the base prefix and a trailing slash. */
export const href = (path: string): string => {
  const base = import.meta.env.BASE_URL.endsWith("/") ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
  const trimmed = path
    .split("/")
    .filter((part) => part !== "")
    .join("/");
  return trimmed === "" ? base : `${base}${trimmed}/`;
};

export const groupText = (lang: Lang, group: RuleGroup): GroupText => groupTextOf(lang, group);
