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
  usedFor: "向いている文章",
  why: "なぜ指摘するのか",
  message: "指摘の文",
  howToFix: "直し方",
  stable: "安定",
  experimental: "試験中",
  deprecated: "廃止予定",
  experimentalNote: "試験中のルールは既定では動きません。chaff.yaml の rules: に名前を書くか、--experimental を付けると動きます。",
  source: "このページはルールの定義ファイルから作られています",
  switchTo: "English",
  backToRules: "ルールの一覧へ",
  error: "エラー",
  warning: "注意",
  info: "情報",
};

export type UiKey = keyof typeof ja;

const en: Record<UiKey, string> = {
  siteTitle: "chaff",
  tagline: "Finds what makes writing hard to read. It never rewrites the text.",
  rules: "Rules",
  genres: "Genres",
  pickGenre: "Pick the kind of document (the genres)",
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
  usedFor: "Suited to",
  why: "Why it matters",
  message: "Message",
  howToFix: "How to fix",
  stable: "stable",
  experimental: "experimental",
  deprecated: "deprecated",
  experimentalNote: "Experimental rules are off by default. Name one under rules: in chaff.yaml, or pass --experimental.",
  source: "This page is built from the rule's definition file",
  switchTo: "日本語",
  backToRules: "All rules",
  error: "error",
  warning: "warning",
  info: "info",
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
