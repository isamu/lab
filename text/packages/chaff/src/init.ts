import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Texts, UiLanguage } from "./ui.ts";
import { loadGenres } from "./genre-load.ts";

const TEXT: Texts<{
  readonly config: (genre: string, summary: string) => string;
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
    config: (genre, summary) => `# chaff.yaml — このチームの文章規範
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
#   npx chaffjs relax bold-density --why "図の説明で太字を多用するため"
#   npx chaffjs explain bold-density        そのルールの意図を読む
#   npx chaffjs rules --json                AI に設定を書かせるときに渡す

# この場所に置く文書の種類（${summary}）。ほかの種類: npx chaffjs genres
genre: ${genre}

# チームが書く固有名詞（組織名・製品名）。1 つの名前として読み、漢字の連なりに数えない。
# names:
#   - 個人情報保護委員会

# このジャンルの指針（よい文書が満たすこと）。検査の結果より先に出て、AI が書き直すときの指示になる。
# 既定は chaff に入っている文。replace で置き換え、add で足し、off で出さない。
# guide:
#   ${genre}:
#     add:
#       - 金額は税込みか税抜きかを書いているか

# 既定から変えたものだけを書く。
rules:
`,
    created: "作成しました",
    appended: (lines) => `${lines.join(" と ")} を追記しました`,
    configNote: "規範の宣言。commit してください",
    exists: "chaff.yaml は既にあります。変更していません。",
    createdHeading: "作成しました:",
    genreChosen: (genre) => `ジャンルは ${genre} にしました。違う場合は chaff.yaml の genre を直してください。`,
    genreList: "  一覧: npx chaffjs genres",
    next: "次:",
    nextCheck: "  npx chaffjs .            この場所の Markdown を全部見る",
  },
  en: {
    config: (genre, summary) => `# chaff.yaml — this team's writing rules
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
#   npx chaffjs relax bold-density --why "figure captions use a lot of bold"
#   npx chaffjs explain bold-density        read what the rule is for
#   npx chaffjs rules --json                give this to an AI that writes the settings

# The kind of document kept here (${summary}). The others: npx chaffjs genres
genre: ${genre}

# The names your team writes (organisations, products). Each is read as one name, not as words to count.
# names:
#   - Bank of England

# This genre's guide: what a good document of this kind does. It comes before the findings, and an AI
# rewriting the text works to it. chaff ships one; replace it, add lines, or turn it off.
# guide:
#   ${genre}:
#     add:
#       - Does each amount say whether tax is included?

# Only what differs from the defaults.
rules:
`,
    created: "created",
    appended: (lines) => `added ${lines.join(" and ")}`,
    configNote: "the team's rules; commit it",
    exists: "chaff.yaml already exists. Nothing was changed.",
    createdHeading: "Created:",
    genreChosen: (genre) => `The genre is ${genre}. If that is wrong, change genre in chaff.yaml.`,
    genreList: "  List: npx chaffjs genres",
    next: "Next:",
    nextCheck: "  npx chaffjs .            check every Markdown file here",
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

/** What the genre is for, as chaff genres says it; the genre itself when chaff does not know it. */
const summaryOf = (genre: string, ui: UiLanguage): string => loadGenres().genres.find((entry) => entry.id === genre)?.summary[ui] ?? genre;

export const runInit = (dir: string, genre: string, ui: UiLanguage = "ja"): string[] => {
  const text = TEXT[ui];
  const made = [writeIfAbsent(join(dir, "chaff.yaml"), text.config(genre, summaryOf(genre, ui)), text.configNote), ensureGitignore(dir, text)].filter(
    (entry) => entry !== undefined,
  );
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
