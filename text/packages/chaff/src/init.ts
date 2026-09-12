import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const CONFIG = (genre: string): string => `# chaff.yaml — このチームの文章規範
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
`;

/** 判定のキャッシュと、鍵を書くファイル。どちらも commit しない。 */
const GITIGNORE_LINES = [".chaff-cache/", ".env", ".env.*"];

type Written = { readonly path: string; readonly note: string };

const writeIfAbsent = (path: string, body: string, note: string): Written | undefined => {
  if (existsSync(path)) return undefined;
  writeFileSync(path, body, "utf8");
  return { path, note };
};

/** 判定のキャッシュと .env は commit しない。init が .gitignore に足す。 */
const ensureGitignore = (dir: string): Written | undefined => {
  const path = join(dir, ".gitignore");
  if (!existsSync(path)) return writeIfAbsent(path, `${GITIGNORE_LINES.join("\n")}\n`, "作成しました");
  const body = readFileSync(path, "utf8");
  const missing = GITIGNORE_LINES.filter((line) => !body.split("\n").includes(line));
  if (missing.length === 0) return undefined;
  appendFileSync(path, `${missing.join("\n")}\n`, "utf8");
  return { path, note: `${missing.join(" と ")} を追記しました` };
};

export const runInit = (dir: string, genre: string): string[] => {
  const made = [writeIfAbsent(join(dir, "chaff.yaml"), CONFIG(genre), "規範の宣言。commit してください"), ensureGitignore(dir)].filter(
    (entry) => entry !== undefined,
  );
  if (made.length === 0) return ["chaff.yaml は既にあります。変更していません。"];
  return [
    "",
    "作成しました:",
    ...made.map((entry) => `  ${entry.path}  ${entry.note}`),
    "",
    `ジャンルは ${genre} にしました。違う場合は chaff.yaml の genre を直してください。`,
    "  一覧: npx chaff genres",
    "",
    "次:",
    "  npx chaff .            この場所の Markdown を全部見る",
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
