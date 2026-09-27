import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Texts, UiLanguage } from "./ui.ts";

const TEXT: Texts<{
  readonly config: (genre: string) => string;
  readonly created: string;
  readonly appended: (lines: readonly string[]) => string;
  readonly configNote: string;
  readonly exists: string;
  readonly createdHeading: string;
  readonly genreChosen: (genre: string) => string;
  readonly genreList: string;
  readonly next: string;
  readonly nextCheck: string;
}> = {
  ja: {
    config: (genre) => `# chaff.yaml — このチームの文章規範
#
# ここに書くのは「既定から変えたもの」だけです。書かなければ既定で動きます。
# このファイルを消しても chaff は動きます。
#
# 値は 4 つの言葉から選びます。数字を書く必要はありません。
#
#   strict    きびしく見る
#   normal    ふつう（既定）
#   relaxed   ゆるく見る
#   off       見ない
#
# コマンドでも変更できます。理由がコメントとして自動で残ります。
#
#   npx chaff relax bold-density --why "図の説明で太字を多用するため"
#   npx chaff explain bold-density        そのルールの意図を読む
#   npx chaff rules --json                AI に設定を書かせるときに渡す

# この場所に置く文書の種類。
genre: ${genre}

# 既定から変えたものだけを書く。
rules:
`,
    created: "作成しました",
    appended: (lines) => `${lines.join(" と ")} を追記しました`,
    configNote: "規範の宣言。commit してください",
    exists: "chaff.yaml は既にあります。変更していません。",
    createdHeading: "作成しました:",
    genreChosen: (genre) => `ジャンルは ${genre} にしました。違う場合は chaff.yaml の genre を直してください。`,
    genreList: "  一覧: npx chaff genres",
    next: "次:",
    nextCheck: "  npx chaff .            この場所の Markdown を全部見る",
  },
  en: {
    config: (genre) => `# chaff.yaml — this team's writing rules
#
# Write only what differs from the defaults; anything left out uses the default.
# chaff still runs if this file is deleted.
#
# A level is one of four words. No numbers needed.
#
#   strict    check closely
#   normal    the default
#   relaxed   check loosely
#   off       do not check
#
# Commands change it too, and leave the reason as a comment.
#
#   npx chaff relax bold-density --why "figure captions use a lot of bold"
#   npx chaff explain bold-density        read what the rule is for
#   npx chaff rules --json                give this to an AI that writes the settings

# The kind of document kept here.
genre: ${genre}

# Only what differs from the defaults.
rules:
`,
    created: "created",
    appended: (lines) => `added ${lines.join(" and ")}`,
    configNote: "the team's rules; commit it",
    exists: "chaff.yaml already exists. Nothing was changed.",
    createdHeading: "Created:",
    genreChosen: (genre) => `The genre is ${genre}. If that is wrong, change genre in chaff.yaml.`,
    genreList: "  List: npx chaff genres",
    next: "Next:",
    nextCheck: "  npx chaff .            check every Markdown file here",
  },
};

/** 判定のキャッシュと、鍵を書くファイル。どちらも commit しない。 */
const GITIGNORE_LINES = [".chaff-cache/", ".env*"];

type Written = { readonly path: string; readonly note: string };

const writeIfAbsent = (path: string, body: string, note: string): Written | undefined => {
  if (existsSync(path)) return undefined;
  writeFileSync(path, body, "utf8");
  return { path, note };
};

/** 判定のキャッシュと .env は commit しない。init が .gitignore に足す。 */
const ensureGitignore = (dir: string, text: (typeof TEXT)["ja"]): Written | undefined => {
  const path = join(dir, ".gitignore");
  if (!existsSync(path)) return writeIfAbsent(path, `${GITIGNORE_LINES.join("\n")}\n`, text.created);
  const body = readFileSync(path, "utf8");
  const missing = GITIGNORE_LINES.filter((line) => !body.split("\n").includes(line));
  if (missing.length === 0) return undefined;
  appendFileSync(path, `${missing.join("\n")}\n`, "utf8");
  return { path, note: text.appended(missing) };
};

export const runInit = (dir: string, genre: string, ui: UiLanguage = "ja"): string[] => {
  const text = TEXT[ui];
  const made = [writeIfAbsent(join(dir, "chaff.yaml"), text.config(genre), text.configNote), ensureGitignore(dir, text)].filter((entry) => entry !== undefined);
  if (made.length === 0) return [text.exists];
  return [
    "",
    text.createdHeading,
    ...made.map((entry) => `  ${entry.path}  ${entry.note}`),
    "",
    text.genreChosen(genre),
    text.genreList,
    "",
    text.next,
    text.nextCheck,
    "",
  ];
};

export const GENRES: readonly string[] = [
  "technical/spec",
  "technical/readme",
  "blog/tech",
  "blog/essay",
  "blog/owned-media",
  "business/proposal",
  "business/report",
  "business/email",
  "business/press-release",
  "business/meeting-notes",
];
