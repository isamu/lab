import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { API_VERSION } from "../api.ts";
import { VERSION } from "../version.ts";
import type { Texts, UiLanguage } from "../ui.ts";

// chaff init --plugin <name>: a rule pack to start from, written in YAML alone. One rule, its word list in Japanese and
// English, and a test command (chaff plugin-test) that checks each rule's example against the rule.

/** A pack's own name: lowercase letters, digits and hyphens, optionally under a scope (@team/house). */
const PACK_NAME = /^(?:(@[a-z0-9][a-z0-9._-]*)\/)?([a-z][a-z0-9-]*)$/u;

export type PackName = { readonly scope: string | undefined; readonly name: string };

/** The name as written after --plugin, or undefined when it cannot be a plugin's name. "chaff-plugin-" in front is allowed and dropped. */
export const packNameOf = (written: string | undefined): PackName | undefined => {
  const match = PACK_NAME.exec((written ?? "").replace(/(^|\/)chaff-plugin-/u, "$1"));
  if (match === null) return undefined;
  const [, scope, name] = match;
  return name === undefined ? undefined : { scope, name };
};

/** The package's name and the folder it is made in: chaff-plugin-house, or @team/chaff-plugin-house in chaff-plugin-house. */
export const packageOf = (pack: PackName): { readonly packageName: string; readonly folder: string } => ({
  packageName: pack.scope === undefined ? `chaff-plugin-${pack.name}` : `${pack.scope}/chaff-plugin-${pack.name}`,
  folder: `chaff-plugin-${pack.name}`,
});

const RULE = `# One rule of the pack. It is written as a rule under custom_rules in chaff.yaml is; see
# https://isamu.github.io/lab/en/guide/adding-rules for every field.
id: avoid-words
type: words
# The words come from lexicons/<language>/avoid-words.yaml, in the document's language.
word_list: avoid-words
name: { ja: チームで使わない言葉, en: A word the team does not use }
why:
  ja: このチームでは、同じものを決まった言葉で呼びます。別の言葉が混ざると、読む人は別のものかと迷います。
  en: The team calls each thing by one word. Another word makes a reader wonder whether it is another thing.
how_to_fix: { ja: チームの言葉に置き換えます。, en: Use the team's word. }
message:
  ja: 「{matched}」ではなく「{preferred}」と書きます
  en: 'Write "{preferred}", not "{matched}"'
level: warning
example:
  ja: { before: 弊社の新しい窓口をご案内します。, after: 当社の新しい窓口をご案内します。 }
  en: { before: We utilize the new form for every request., after: We use the new form for every request. }
rewrite:
  depth: light
  ja:
    direction: 指された言葉だけを、チームの言葉に置き換えます。
    pairs:
      - { before: 弊社の新しい窓口をご案内します。, after: 当社の新しい窓口をご案内します。 }
      - { before: 弊社では毎月点検しています。, after: 当社では毎月点検しています。 }
    keep: [文のほかの部分]
    avoid: [言葉と一緒に文の意味を変える]
  en:
    direction: Replace only the flagged word with the team's word.
    pairs:
      - { before: We utilize the new form for every request., after: We use the new form for every request. }
      - { before: Utilize the search box first., after: Use the search box first. }
    keep: [the rest of the sentence]
    avoid: [changing what the sentence says along with the word]
`;

const LEXICON_JA = `# 使わない言葉（pattern）と、使う言葉（rewrite）。
- { pattern: 弊社, rewrite: 当社 }
`;

const LEXICON_EN = `# The word not to use (pattern) and the word to use (rewrite).
- { pattern: utilize, rewrite: use }
`;

const packageJson = (packageName: string): string =>
  `${JSON.stringify(
    {
      name: packageName,
      version: "0.1.0",
      description: "Rules for chaff, written in YAML.",
      files: ["rules", "lexicons", "styles"],
      chaff: { apiVersion: API_VERSION },
      scripts: { test: "chaffjs plugin-test ." },
      peerDependencies: { chaffjs: `>=${VERSION}` },
    },
    null,
    2,
  )}\n`;

const FILES = (packageName: string): Readonly<Record<string, string>> => ({
  "package.json": packageJson(packageName),
  "rules/avoid-words.yaml": RULE,
  "lexicons/ja/avoid-words.yaml": LEXICON_JA,
  "lexicons/en/avoid-words.yaml": LEXICON_EN,
});

const TEXT: Texts<{
  readonly badName: (written: string) => string;
  readonly exists: (folder: string) => string;
  readonly made: (folder: string, packageName: string) => string;
  readonly next: (folder: string, name: string) => readonly string[];
}> = {
  ja: {
    badName: (written) => `--plugin ${written}: プラグインの名前は英小文字・数字・ハイフンで書きます（house、@team/house）`,
    exists: (folder) => `${folder} はもうあります。上書きしないので、別の名前にするか消してから実行してください`,
    made: (folder, packageName) => `${folder}/ に YAML だけのルールの束 ${packageName} を作りました。`,
    next: (folder, name) => [
      "",
      "次に:",
      `  cd ${folder} && npx chaffjs plugin-test .    ルールの例をルールにかけて確かめる`,
      `  chaff.yaml に plugins: [./${folder}] と書くと、${name}/avoid-words として動きます`,
      "",
    ],
  },
  en: {
    badName: (written) => `--plugin ${written}: a plugin's name is lowercase letters, digits and hyphens (house, @team/house)`,
    exists: (folder) => `${folder} already exists. Nothing is overwritten; choose another name or remove it first`,
    made: (folder, packageName) => `Made the YAML rule pack ${packageName} in ${folder}/.`,
    next: (folder, name) => [
      "",
      "Next:",
      `  cd ${folder} && npx chaffjs plugin-test .    check each rule against its own example`,
      `  add plugins: [./${folder}] to chaff.yaml and it runs as ${name}/avoid-words`,
      "",
    ],
  },
};

/** Makes the pack in dir. Lines to print, and whether it was made; nothing is written when the folder is already there. */
export const initPlugin = (dir: string, written: string | undefined, ui: UiLanguage): { readonly ok: boolean; readonly lines: readonly string[] } => {
  const text = TEXT[ui];
  const pack = packNameOf(written);
  if (pack === undefined) return { ok: false, lines: [text.badName(written ?? "")] };
  const { packageName, folder } = packageOf(pack);
  if (existsSync(join(dir, folder))) return { ok: false, lines: [text.exists(folder)] };
  Object.entries(FILES(packageName)).forEach(([path, body]) => {
    mkdirSync(dirname(join(dir, folder, path)), { recursive: true });
    writeFileSync(join(dir, folder, path), body, "utf8");
  });
  const name = pack.scope === undefined ? pack.name : `${pack.scope}/${pack.name}`;
  return {
    ok: true,
    lines: [text.made(folder, packageName), ...Object.keys(FILES(packageName)).map((path) => `  ${folder}/${path}`), ...text.next(folder, name)],
  };
};

/** chaff init --plugin <name>: makes the pack in dir and says what it made, or why it did not. */
export const runInitPlugin = (dir: string, written: string | undefined, ui: UiLanguage): number => {
  const made = initPlugin(dir, written, ui);
  made.lines.forEach((line) => (made.ok ? console.log(line) : console.error(line)));
  return made.ok ? 0 : 1;
};
