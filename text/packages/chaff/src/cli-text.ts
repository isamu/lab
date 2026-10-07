// What the command line says, in Japanese and English. Per-file text follows the file's language; the rest
// follows hostLanguage (chaff.yaml's language, else the terminal's locale).
import type { Texts } from "./ui.ts";
import { counted, formFor } from "./render/plural.ts";
import type { GenreSetting } from "./genre-check.ts";
import type { ProfileSetting } from "./profile/check.ts";

const ASCII_AT = /[\x21-\x7e]/u;

/** A word set in Japanese text with a space on each side where it starts or ends with Latin text, as the guide writes it. */
const spacedInJapanese = (word: string): string => `${ASCII_AT.test(word.at(0) ?? "") ? " " : ""}${word}${ASCII_AT.test(word.at(-1) ?? "") ? " " : ""}`;

/** What a folder walk looked for, and how to look for more. Markdown always; include adds file-name globs. */
const lookedForJa = (include: readonly string[]): string => {
  const also = include.length > 0 ? `と ${include.join(" ")}` : "";
  return `  探したもの: Markdown（.md .markdown .mdx）${also}。ほかのファイルも検査するには、chaff.yaml に include: ["*.yaml"] と書くか、--include "*.yaml" を付けてください。`;
};

const lookedForEn = (include: readonly string[]): string => {
  const also = include.length > 0 ? ` and ${include.join(", ")}` : "";
  return `  Looked for Markdown (.md, .markdown, .mdx)${also}. To check other files too, add include: ["*.yaml"] to chaff.yaml, or pass --include "*.yaml".`;
};

/** Where a file's genre came from, as the header names it. */
export type GenreSource = "--genre" | "by_path" | "config" | "default" | "front-matter" | "path" | "content";

const USAGE_JA = `chaff — 文章の読みにくいところを見つけます。文章は書き換えません。

  chaff <file|dir|glob>...       検査する（設定も API key も要りません）
  chaff .                        この場所の Markdown を全部
  chaff test <file|dir>...       意味を読む検査も動かす（API key が要ります）
                                 判定役は chaff.yaml の ai_backend で選びます
  chaff init                     chaff.yaml を作る（端末ならジャンルを尋ねる。--genre <ジャンル> でも選べる）
  chaff init --plugin <名前>     YAML だけのルールの束（chaff-plugin-<名前>/）を作る
  chaff plugin-test [フォルダ]   プラグインの各ルールを、そのルールの例にかけて確かめる
  chaff --version                chaffjs と言語パッケージの版
  chaff eval <dir> [--rule <rule>]  手元の文書で閾値を測り直す（--rule でそのルールだけ）
  chaff explain <rule>           そのルールの意図と根拠を読む
  chaff genres                   ジャンル（文書の種類）の一覧と、それぞれ何向けか
  chaff tree <file> [--format sexp|json]  文書を番地の付いた木にする（条・項・定義・参照）
  chaff cite <原文> <引用.json> [--format text|json]  回答の引用（番地と引用文）が原文にあるかを確かめる
  chaff cite --scaffold <file>           出典の無い引用を、出典を書き込む引用.json のひな形にする
  chaff cite --url <URL> <引用.json>      引用が Web のページにあるかを確かめる（取得したページは HTML から Markdown にして読む）
  chaff compare <前> <後> [--json|--compact]  書き換えで事実（数・日付・URL・コード・名前・引用…）が落ちても足されてもいないかを確かめる
                                 --allow-dropped <種類> と --allow-added <種類> は、その種類の欠落・追加を許す（カンマで並べる。種類は number date time url code name quote heading reference footnote）
                                 --distinct は、何回述べたかではなく、述べているかだけを比べる
  chaff facts <file> [--json|--compact]  compare が照合する事実を、書き直す前の控えとして一覧にする
  chaff outline <file> [<後>] [--json|--compact]  見出しの構成と形（見出しの数・節の平均の長さ・箇条書きの割合・太字）を測る。2 つなら前と後を並べる
  chaff ai-score <file>... [--format text|json] [--json] [--compact]
                                 AI らしさの簡易判定（低・中・高）。生成文に多い目印を、同じジャンルの人の文書と比べる（書いたのが AI かは判定しない）
                                 --json は --format json と同じ。--compact はファイルごとに 1 行
  chaff grade <items.jsonl> [--out <results.jsonl>] [--baseline <前の results.jsonl>] [--allow-stamp-mismatch]
              [--variant-key <欄>] [--format text|json|markdown] [--json] [--compact]
                                 AI の出力を JSONL でまとめて採点する（指摘の率・事実・引用・合否。何も送らない）
                                 --allow-stamp-mismatch はルールか設定が前の回と違っても比べる（そのことを先に出す）
                                 --variant-key は variant の欄の代わりにその欄で出力を分けて並べる。--json は --format json と同じ。markdown は PR のコメント向け
  chaff fix-plan <file> [--depth light|structure|register] [--json]
                                 指摘をルールごとにまとめ、直す方向と確かめのコマンドを、書き直す人や AI 向けの計画にする（何も送らない）
  chaff rules                    ルールの一覧を、グループごとに表で出す（いまの段階つき）
  chaff rules --json             いまの設定とルールの説明を JSON で出す（AI に渡す用）
  chaff baseline <dir>           いまある指摘を棚上げする（既存の repo に入れるとき）
  chaff suppressions <dir>       stet で黙らせている指摘を数える
  chaff relax|strict|off <rule> [--why "理由"]
  chaff enable <rule> [--why "理由"]  試験中のルールを 1 つだけ動かす（chaff.yaml の rules に <rule>: normal と書く）
  chaff skill [--global] [--force]  Claude Code の skill を入れる（.claude/skills/chaff/、--global で ~/.claude/）
                                 手で直したらしい skill は置き換えない。--force で置き換える
  chaff feedback <file> --rule <rule> [--line N] | --missed --line N
                                 誤った指摘・見逃しの報告の下書きを作る（何も送らない。--with-config で chaff.yaml 全体も載せる）

  --compact         エンジニア向けの 1 行形式
  --no-guide        ジャンルを決めたときに最初に出す、そのジャンルの指針を出さない
  --experimental    試験中の rule も動かす
  --genre <ジャンル>  この実行だけジャンルを決める（chaff.yaml より優先）
  --show-baseline   棚上げした分も含めて全部見る
  --watch           保存のたびに見直し、変わったところだけ出す
  --dry-run         test で、何を AI に送るかだけを見る（API を呼びません）
  --sarif <path>    指摘を SARIF で書き出す（GitHub の PR の行に出すため）
  --include <glob>  フォルダを見るとき、Markdown のほかにこのファイルも検査する（--include "*.yaml"。chaff.yaml の include と同じ）
  --language <ja|en>  tree・cite・compare・facts・outline・ai-score で、文書の言語を決める（chaff.yaml と中身からの推定より優先）

この箇所だけ黙らせる:  <!-- stet: rule-id — 理由 -->

値は strict / normal / relaxed / off の 4 つから選びます。
`;

const USAGE_EN = `chaff — finds what makes writing hard to read. It never rewrites the text.

  chaff <file|dir|glob>...       check (no config or API key needed)
  chaff .                        every Markdown file here
  chaff test <file|dir>...       also run the checks that read meaning (needs an API key)
                                 the judge is chosen by ai_backend in chaff.yaml
  chaff init                     create chaff.yaml (asks for the genre at a terminal; --genre <genre> chooses it)
  chaff init --plugin <name>     create a YAML rule pack, chaff-plugin-<name>/
  chaff plugin-test [folder]     run each rule of a plugin on the rule's own example
  chaff --version                the version of chaffjs and its language packages
  chaff eval <dir> [--rule <rule>]  re-measure the limits on your own documents (--rule: that rule only)
  chaff explain <rule>           read what a rule is for and why
  chaff genres                   list the genres (kinds of document) and what each is for
  chaff tree <file> [--format sexp|json]  the document as a tree of addresses (sections, clauses, definitions, references)
  chaff cite <source> <quotes.json> [--format text|json]  check that quoted passages (address and text) are in the source
  chaff cite --scaffold <file>            a quotes.json to fill in with sources, from the quotations that give none
  chaff cite --url <URL> <quotes.json>    check quotations against a web page (fetched, HTML read as Markdown)
  chaff compare <before> <after> [--json|--compact]  check that a rewrite dropped no fact and added none (numbers, dates, URLs, code, names, quotations…)
                                 --allow-dropped <kinds> and --allow-added <kinds> allow those kinds to go or come (comma-separated: number date time url code name quote heading reference footnote)
                                 --distinct compares only whether a fact is stated, not how many times
  chaff facts <file> [--json|--compact]   list the facts compare checks, as an inventory to keep before a rewrite
  chaff outline <file> [<after>] [--json|--compact]  measure the outline and its shape (headings, average section length, text in lists, bold); two files side by side
  chaff ai-score <file>... [--format text|json] [--json] [--compact]
                                 quick AI-likeness score (low, medium, high): signs common in generated text against human documents of the genre (not a verdict on who wrote it)
                                 --json is --format json; --compact prints one line per file
  chaff grade <items.jsonl> [--out <results.jsonl>] [--baseline <earlier results.jsonl>] [--allow-stamp-mismatch]
              [--variant-key <field>] [--format text|json|markdown] [--json] [--compact]
                                 grade a JSONL file of model outputs (finding rates, facts, quotations, pass or fail; sends nothing)
                                 --allow-stamp-mismatch compares with the baseline even when its rules or settings differ, saying so first
                                 --variant-key splits the outputs by that field instead of variant; --json is --format json; markdown is for a PR comment
  chaff fix-plan <file> [--depth light|structure|register] [--json]
                                 a plan for whoever rewrites the file, a person or an AI: findings by rule, how to rewrite each, the checks to run after (sends nothing)
  chaff rules                    the rules as a table, by group, with the level each runs at now
  chaff rules --json             the current settings and what each rule is, as JSON (to give to an AI)
  chaff baseline <dir>           shelve today's findings (when adding chaff to an existing repository)
  chaff suppressions <dir>       count the findings silenced with stet
  chaff relax|strict|off <rule> [--why "reason"]
  chaff enable <rule> [--why "reason"]  turn on one experimental rule alone (writes <rule>: normal under rules in chaff.yaml)
  chaff skill [--global] [--force]  install the Claude Code skill (.claude/skills/chaff/; --global for ~/.claude/)
                                 a skill that looks edited by hand is kept; --force replaces it
  chaff feedback <file> --rule <rule> [--line N] | --missed --line N
                                 draft a report of a wrong or missed finding (sends nothing; --with-config adds all of chaff.yaml)

  --compact         one line per finding, for engineers
  --no-guide        leave out the genre's guide, which comes first when the genre is set
  --experimental    run the experimental rules too
  --genre <genre>   the genre for this run only (wins over chaff.yaml)
  --show-baseline   show the shelved findings too
  --watch           re-check on every save and print only what changed
  --dry-run         with test, show what would be sent to the AI (no API call)
  --sarif <path>    write the findings as SARIF (for comments on a GitHub PR)
  --include <glob>  in a folder, check these files besides Markdown (--include "*.yaml"; as include in chaff.yaml)
  --language <ja|en>  with tree, cite, compare, facts, outline and ai-score, the document's language (wins over chaff.yaml and the guess from the text)

Silence one spot:  <!-- stet: rule-id — reason -->

A rule's level is one of strict / normal / relaxed / off.
`;

export type CliText = {
  readonly usage: string;
  /** Under one command's lines of the usage, for `chaff <command> --help`. */
  readonly moreHelp: string;
  readonly languageName: (language: string) => string;
  readonly genreSource: Readonly<Record<GenreSource, string>>;
  readonly header: (path: string, genre: string, language: string, from: string, shelved: number, hushed: number) => string;
  readonly suggested: (name: string, genre: string) => string;
  readonly suggestedNote: (name: string, genre: string, used: string) => string;
  /** Nothing to check among targets; include: the globs looked for besides Markdown. Says how to look for more. */
  readonly noMarkdown: (targets: string, include: readonly string[]) => string;
  readonly noMarkdownHere: (include: readonly string[]) => string;
  readonly noAdapter: (language: string) => string;
  readonly unknownGenre: (genre: string, where: string, known: readonly string[]) => string;
  readonly genreWhere: (where: GenreSetting, files: readonly string[]) => string;
  readonly unreadFrontMatterGenre: (path: string, genre: string, known: readonly string[]) => string;
  readonly unknownProfile: (profile: string, where: string, known: readonly string[]) => string;
  readonly profileWhere: (where: ProfileSetting, files: readonly string[]) => string;
  readonly unknownRule: (id: string) => string;
  readonly unknownRuleWithList: (id: string, list: string) => string;
  readonly unnamed: string;
  readonly sarifWritten: (path: string, count: number) => string;
  readonly unchanged: string;
  readonly findingsUnit: (count: number) => string;
  readonly watching: (files: number, findings: number) => string;
  readonly watchHint: string;
  readonly baselineDone: (files: number, entries: number, file: string) => readonly string[];
};

export const CLI_TEXT: Texts<CliText> = {
  ja: {
    usage: USAGE_JA,
    moreHelp: "すべてのコマンドと共通の指定は npx chaffjs --help で出ます。",
    languageName: (language) => (language === "ja" ? "日本語" : "英語"),
    genreSource: {
      "--genre": "--genre",
      by_path: "chaff.yaml の by_path",
      config: "chaff.yaml",
      default: "既定",
      "front-matter": "front matter",
      path: "パス",
      content: "内容",
    },
    header: (path, genre, language, from, shelved, hushed) =>
      [
        `${path}   ${genre} · ${language}   ジャンルは${spacedInJapanese(from)}から`,
        shelved > 0 ? `   棚上げ ${shelved} 件` : "",
        hushed > 0 ? `   stet ${hushed} 件` : "",
      ].join(""),
    suggested: (name, genre) => `   ${name}のようです。--genre ${genre} を試せます`,
    suggestedNote: (name, genre, used) =>
      `  ジャンルを決めていないので、${used} として見ました。${name}なら、--genre ${genre} でその種類の書き方に合わせて見ます（npx chaffjs genres で一覧）。`,
    noMarkdown: (targets, include) => `検査するファイルが 1 つも見つかりませんでした: ${targets}\n${lookedForJa(include)}`,
    noMarkdownHere: (include) => `検査するファイルが 1 つも見つかりませんでした。\n${lookedForJa(include)}`,
    noAdapter: (language) => `言語 "${language}" のアダプタがありません。`,
    unknownGenre: (genre, where, known) =>
      `ジャンル "${genre}" はありません（${where}）。使えるのは ${known.join("、")} です。npx chaffjs genres で一覧が出ます。`,
    genreWhere: (where, files) => {
      if (where === "config") return "chaff.yaml の genre";
      return where === "by_path" ? `chaff.yaml の by_path、files: ${files.join(", ")}` : "--genre";
    },
    unreadFrontMatterGenre: (path, genre, known) =>
      `${path}: front matter の genre "${genre}" はジャンルではないので読みませんでした。使えるのは ${known.join("、")} です。`,
    unknownProfile: (profile, where, known) =>
      `文書の種類 "${profile}" はありません（${where}）。使えるのは ${known.join("、")} と、種類を使わない none です。`,
    profileWhere: (where, files) => (where === "config" ? "chaff.yaml の profile" : `chaff.yaml の by_path、files: ${files.join(", ")}`),
    unknownRule: (id) => `${id} というルールはありません。npx chaffjs rules で一覧が出ます。`,
    unknownRuleWithList: (id, list) => `${id} というルールはありません。\n一覧:\n${list}`,
    unnamed: "(名前なし)",
    sarifWritten: (path, count) => `\n  SARIF を書きました: ${path}（${count} 件）`,
    unchanged: "変わりませんでした",
    findingsUnit: () => " 件",
    watching: (files, findings) => `\n  ${files} ファイルを見ています。いまの指摘は ${findings} 件です。`,
    watchHint: "  保存するたびに、変わったところだけ出します。止めるには Ctrl-C。\n",
    baselineDone: (files, entries, file) => [
      "",
      `  ${files} ファイルを走査しました。`,
      "",
      `  ${entries} 件の指摘を ${file} に記録しました。`,
      "  以後、これらは報告されません。新しく増えたものだけが出ます。",
      "",
      `  ${file} を commit してください。`,
      "",
    ],
  },
  en: {
    usage: USAGE_EN,
    moreHelp: "npx chaffjs --help lists every command and the options they share.",
    languageName: (language) => (language === "ja" ? "Japanese" : "English"),
    genreSource: {
      "--genre": "--genre",
      by_path: "by_path in chaff.yaml",
      config: "chaff.yaml",
      default: "the default",
      "front-matter": "front matter",
      path: "the path",
      content: "the content",
    },
    header: (path, genre, language, from, shelved, hushed) =>
      [`${path}   ${genre} · ${language}   genre from ${from}`, shelved > 0 ? `   ${shelved} shelved` : "", hushed > 0 ? `   ${hushed} stet` : ""].join(""),
    suggested: (name, genre) => `   Looks like: ${name}. Try --genre ${genre}`,
    suggestedNote: (name, genre, used) =>
      `  No genre was set, so this was checked as ${used}. If it is ${name}, --genre ${genre} checks it the way that kind is written (npx chaffjs genres lists them).`,
    noMarkdown: (targets, include) => `No files to check found: ${targets}\n${lookedForEn(include)}`,
    noMarkdownHere: (include) => `No files to check found.\n${lookedForEn(include)}`,
    noAdapter: (language) => `No language package for "${language}".`,
    unknownGenre: (genre, where, known) => `There is no genre "${genre}" (${where}). The genres are ${known.join(", ")}. npx chaffjs genres lists them.`,
    genreWhere: (where, files) => {
      if (where === "config") return "genre in chaff.yaml";
      return where === "by_path" ? `by_path in chaff.yaml, files: ${files.join(", ")}` : "--genre";
    },
    unreadFrontMatterGenre: (path, genre, known) =>
      `${path}: the front matter's genre "${genre}" is not a genre, so it was not used. The genres are ${known.join(", ")}.`,
    unknownProfile: (profile, where, known) =>
      `There is no document profile "${profile}" (${where}). The profiles are ${known.join(", ")}; none uses no profile.`,
    profileWhere: (where, files) => (where === "config" ? "profile in chaff.yaml" : `by_path in chaff.yaml, files: ${files.join(", ")}`),
    unknownRule: (id) => `There is no rule named ${id}. npx chaffjs rules lists them.`,
    unknownRuleWithList: (id, list) => `There is no rule named ${id}.\nRules:\n${list}`,
    unnamed: "(no name)",
    sarifWritten: (path, count) => `\n  Wrote SARIF: ${path} (${counted(count, "finding")})`,
    unchanged: "no change",
    findingsUnit: (count) => ` ${formFor(count, "finding", "findings")}`,
    watching: (files, findings) => `\n  Watching ${counted(files, "file")}. ${counted(findings, "finding")} now.`,
    watchHint: "  Each save prints only what changed. Ctrl-C to stop.\n",
    baselineDone: (files, entries, file) => [
      "",
      `  Checked ${counted(files, "file")}.`,
      "",
      `  Recorded ${counted(entries, "finding")} in ${file}.`,
      "  They will not be reported again; only new ones will.",
      "",
      `  Commit ${file}.`,
      "",
    ],
  },
};
