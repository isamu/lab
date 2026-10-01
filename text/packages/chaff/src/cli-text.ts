// What the command line says, in Japanese and English. Per-file text follows the file's language; the rest
// follows hostLanguage (chaff.yaml's language, else the terminal's locale).
import type { Texts } from "./ui.ts";
import { counted, formFor } from "./render/plural.ts";
import type { GenreSetting } from "./genre-check.ts";
import type { ProfileSetting } from "./profile/check.ts";

/** Where a file's genre came from, as the header names it. */
export type GenreSource = "--genre" | "by_path" | "config" | "default" | "front-matter" | "path" | "content";

const USAGE_JA = `chaff — 文章の読みにくいところを見つけます。文章は書き換えません。

  chaff <file|dir|glob>...       検査する（設定も API key も要りません）
  chaff .                        この場所の Markdown を全部
  chaff test <file|dir>...       意味を読む検査も動かす（API key が要ります）
                                 判定役は chaff.yaml の ai_backend で選びます
  chaff init                     chaff.yaml を作る（端末ならジャンルを尋ねる。--genre <ジャンル> でも選べる）
  chaff --version                chaffjs と言語パッケージの版
  chaff eval <dir>               手元の文書で閾値を測り直す
  chaff explain <rule>           そのルールの意図と根拠を読む
  chaff genres                   ジャンル（文書の種類）の一覧と、それぞれ何向けか
  chaff tree <file> [--format sexp|json]  文書を番地の付いた木にする（条・項・定義・参照）
  chaff cite <原文> <引用.json>           回答の引用（番地と引用文）が原文にあるかを確かめる
  chaff compare <前> <後>                書き換えで事実（数・日付・URL・コード・名前・引用…）が落ちても足されてもいないかを確かめる
  chaff rules                    ルールの一覧を、グループごとに表で出す（いまの段階つき）
  chaff rules --json             いまの設定とルールの説明を JSON で出す（AI に渡す用）
  chaff baseline <dir>           いまある指摘を棚上げする（既存の repo に入れるとき）
  chaff suppressions <dir>       stet で黙らせている指摘を数える
  chaff relax|strict|off <rule> [--why "理由"]
  chaff skill [--global]         Claude Code の skill を入れる（.claude/skills/chaff/、--global で ~/.claude/）
  chaff feedback <file> --rule <rule> [--line N] | --missed --line N
                                 誤った指摘・見逃しの報告の下書きを作る（何も送らない。--with-config で chaff.yaml 全体も載せる）

  --compact         エンジニア向けの 1 行形式
  --experimental    試験中の rule も動かす
  --genre <ジャンル>  この実行だけジャンルを決める（chaff.yaml より優先）
  --show-baseline   棚上げした分も含めて全部見る
  --watch           保存のたびに見直し、変わったところだけ出す
  --dry-run         test で、何を AI に送るかだけを見る（API を呼びません）
  --sarif <path>    指摘を SARIF で書き出す（GitHub の PR の行に出すため）

この箇所だけ黙らせる:  <!-- stet: rule-id — 理由 -->

値は strict / normal / relaxed / off の 4 つから選びます。
`;

const USAGE_EN = `chaff — finds what makes writing hard to read. It never rewrites the text.

  chaff <file|dir|glob>...       check (no config or API key needed)
  chaff .                        every Markdown file here
  chaff test <file|dir>...       also run the checks that read meaning (needs an API key)
                                 the judge is chosen by ai_backend in chaff.yaml
  chaff init                     create chaff.yaml (asks for the genre at a terminal; --genre <genre> chooses it)
  chaff --version                the version of chaffjs and its language packages
  chaff eval <dir>               re-measure the limits on your own documents
  chaff explain <rule>           read what a rule is for and why
  chaff genres                   list the genres (kinds of document) and what each is for
  chaff tree <file> [--format sexp|json]  the document as a tree of addresses (sections, clauses, definitions, references)
  chaff cite <source> <quotes.json>       check that quoted passages (address and text) are in the source
  chaff compare <before> <after>          check that a rewrite dropped no fact and added none (numbers, dates, URLs, code, names, quotations…)
  chaff rules                    the rules as a table, by group, with the level each runs at now
  chaff rules --json             the current settings and what each rule is, as JSON (to give to an AI)
  chaff baseline <dir>           shelve today's findings (when adding chaff to an existing repository)
  chaff suppressions <dir>       count the findings silenced with stet
  chaff relax|strict|off <rule> [--why "reason"]
  chaff skill [--global]         install the Claude Code skill (.claude/skills/chaff/; --global for ~/.claude/)
  chaff feedback <file> --rule <rule> [--line N] | --missed --line N
                                 draft a report of a wrong or missed finding (sends nothing; --with-config adds all of chaff.yaml)

  --compact         one line per finding, for engineers
  --experimental    run the experimental rules too
  --genre <genre>   the genre for this run only (wins over chaff.yaml)
  --show-baseline   show the shelved findings too
  --watch           re-check on every save and print only what changed
  --dry-run         with test, show what would be sent to the AI (no API call)
  --sarif <path>    write the findings as SARIF (for comments on a GitHub PR)

Silence one spot:  <!-- stet: rule-id — reason -->

A rule's level is one of strict / normal / relaxed / off.
`;

export type CliText = {
  readonly usage: string;
  readonly languageName: (language: string) => string;
  readonly genreSource: Readonly<Record<GenreSource, string>>;
  readonly header: (path: string, genre: string, language: string, from: string, shelved: number, hushed: number) => string;
  readonly suggested: (name: string, genre: string) => string;
  readonly suggestedNote: (name: string, genre: string, used: string) => string;
  readonly noMarkdown: (targets: string) => string;
  readonly noMarkdownHere: string;
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
  readonly unit: (ruleId: string, language: string) => string;
};

export const CLI_TEXT: Texts<CliText> = {
  ja: {
    usage: USAGE_JA,
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
      [`${path}   ${genre} · ${language}   ジャンルは${from}から`, shelved > 0 ? `   棚上げ ${shelved} 件` : "", hushed > 0 ? `   stet ${hushed} 件` : ""].join(
        "",
      ),
    suggested: (name, genre) => `   ${name}のようです。--genre ${genre} を試せます`,
    suggestedNote: (name, genre, used) =>
      `  ジャンルを決めていないので、${used} として見ました。${name}なら、--genre ${genre} でその種類の書き方に合わせて見ます（npx chaffjs genres で一覧）。`,
    noMarkdown: (targets) => `Markdown が 1 つも見つかりませんでした: ${targets}`,
    noMarkdownHere: "Markdown が 1 つも見つかりませんでした。",
    noAdapter: (language) => `言語 "${language}" のアダプタがありません。`,
    unknownGenre: (genre, where, known) =>
      `ジャンル "${genre}" はありません（${where}）。使えるのは ${known.join("、")} です。npx chaff genres で一覧が出ます。`,
    genreWhere: (where, files) => {
      if (where === "config") return "chaff.yaml の genre";
      return where === "by_path" ? `chaff.yaml の by_path、files: ${files.join(", ")}` : "--genre";
    },
    unreadFrontMatterGenre: (path, genre, known) =>
      `${path}: front matter の genre "${genre}" はジャンルではないので読みませんでした。使えるのは ${known.join("、")} です。`,
    unknownProfile: (profile, where, known) =>
      `文書の種類 "${profile}" はありません（${where}）。使えるのは ${known.join("、")} と、種類を使わない none です。`,
    profileWhere: (where, files) => (where === "config" ? "chaff.yaml の profile" : `chaff.yaml の by_path、files: ${files.join(", ")}`),
    unknownRule: (id) => `${id} というルールはありません。npx chaff rules で一覧が出ます。`,
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
    unit: (ruleId, language) => {
      if (ruleId === "bold-density") return "1000 字あたりの箇所数";
      if (ruleId !== "max-sentence-length") return "回";
      return language === "ja" ? "文字" : "語";
    },
  },
  en: {
    usage: USAGE_EN,
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
    noMarkdown: (targets) => `No Markdown files found: ${targets}`,
    noMarkdownHere: "No Markdown files found.",
    noAdapter: (language) => `No language package for "${language}".`,
    unknownGenre: (genre, where, known) => `There is no genre "${genre}" (${where}). The genres are ${known.join(", ")}. npx chaff genres lists them.`,
    genreWhere: (where, files) => {
      if (where === "config") return "genre in chaff.yaml";
      return where === "by_path" ? `by_path in chaff.yaml, files: ${files.join(", ")}` : "--genre";
    },
    unreadFrontMatterGenre: (path, genre, known) =>
      `${path}: the front matter's genre "${genre}" is not a genre, so it was not used. The genres are ${known.join(", ")}.`,
    unknownProfile: (profile, where, known) =>
      `There is no document profile "${profile}" (${where}). The profiles are ${known.join(", ")}; none uses no profile.`,
    profileWhere: (where, files) => (where === "config" ? "profile in chaff.yaml" : `by_path in chaff.yaml, files: ${files.join(", ")}`),
    unknownRule: (id) => `There is no rule named ${id}. npx chaff rules lists them.`,
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
    unit: (ruleId, language) => {
      if (ruleId === "bold-density") return "places per 1000 characters";
      if (ruleId !== "max-sentence-length") return "times";
      return language === "ja" ? "characters" : "words";
    },
  },
};
