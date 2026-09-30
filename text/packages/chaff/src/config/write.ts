import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { Scalar, YAMLMap, isMap, isScalar, parseDocument, type Document } from "yaml";
import { definedLevels, severityAt } from "../levels.ts";
import { SEVERITY_NAME, withArticle } from "../render/severity-name.ts";
import { readableText } from "../render/text.ts";
import type { Level, RuleDefinition } from "../plugin.ts";
import { uiLanguageOf, type Texts } from "../ui.ts";

const TEXT: Texts<{
  readonly template: string;
  readonly noSuchLevel: (id: string, level: string) => string;
  readonly hasReason: (id: string, previous: string) => string;
  readonly done: (id: string, level: string, path: string) => string;
  readonly severityMoved: (from: string, to: string) => string;
}> = {
  ja: {
    template: `# chaff.yaml — このチームの文章規範
#
# ここに書くのは「既定から変えたもの」だけです。
# 値は strict / normal / relaxed / off の 4 つから選びます。数字は要りません。

rules:
`,
    noSuchLevel: (id, level) => `${id} に ${level} はありません。normal と同じ設定です。\n設定は変更しませんでした。`,
    hasReason: (id, previous) => `${id} には既に理由が書かれています:\n  ${previous}\n値を変えるときは --why で新しい理由を書いてください。`,
    done: (id, level, path) => `${id} を ${level} にしました（${path}）`,
    severityMoved: (from, to) => `このルールに数の上限はありません。指摘は消えず、${from} ではなく ${to} として出ます。`,
  },
  en: {
    template: `# chaff.yaml — this team's writing rules
#
# Write only what differs from the defaults.
# A level is one of strict / normal / relaxed / off. No numbers needed.

rules:
`,
    noSuchLevel: (id, level) => `${id} has no ${level} level; it is the same as normal.\nThe settings were not changed.`,
    hasReason: (id, previous) => `${id} already has a reason:\n  ${previous}\nTo change the level, give a new reason with --why.`,
    done: (id, level, path) => `Set ${id} to ${level} (${path})`,
    severityMoved: (from, to) => `This rule has no numeric limit: its findings still show, as ${withArticle(to)} instead of ${withArticle(from)}.`,
  },
};

export type ChangeOutcome = { readonly ok: boolean; readonly message: string };

const today = (): string => new Date().toISOString().slice(0, 10);

const reasonOf = (value: unknown): string | undefined => {
  if (!isScalar(value) || typeof value.comment !== "string") return undefined;
  const text = value.comment.trim();
  return text.length === 0 ? undefined : text;
};

const ruleComment = (rule: RuleDefinition, language: string): string =>
  ` ${readableText(rule, rule.name, language)}\n ${readableText(rule, rule.why, language)}`;

const load = (path: string, language: string): Document => parseDocument(existsSync(path) ? readFileSync(path, "utf8") : TEXT[uiLanguageOf(language)].template);

/**
 * 設定を機械的に書き換えるが、**既存のコメントを壊さない**。
 * 設定ファイルがチームの規範そのものである以上、コメントが失われることは規範が失われること。
 * spec §19.4。
 */
export const applyLevel = (path: string, rule: RuleDefinition, level: Level, why: string | undefined, language: string, who: string): ChangeOutcome => {
  const text = TEXT[uiLanguageOf(language)];
  if (!definedLevels(rule).includes(level)) return { ok: false, message: text.noSuchLevel(rule.id, level) };
  const doc = load(path, language);
  const rules = doc.get("rules");
  const map = isMap(rules) ? rules : new YAMLMap();
  // 人が読んで書き足すファイルなので、必ず block style にする。flow style（{ a: b }）は読めない。
  map.flow = false;
  if (!isMap(rules)) doc.set("rules", map);
  const existing = map.items.find((pair) => String(pair.key) === rule.id);
  const previous = reasonOf(existing?.value);
  // 古い理由が新しい値に付いたまま残ると、履歴が嘘になる。
  if (previous !== undefined && why === undefined) {
    return { ok: false, message: text.hasReason(rule.id, previous) };
  }
  // 取り除いて足し直すと、元の rule に付いていた説明コメントが行き場を失って残る。
  // 既にある鍵は、その場で値だけ差し替える。
  const value = new Scalar(level);
  if (why !== undefined) value.comment = ` ${today()} ${why} / ${who}`;
  if (existing === undefined) {
    map.items = [...map.items, doc.createPair(rule.id, value)];
    const added = map.items.at(-1);
    if (added !== undefined && isScalar(added.key)) added.key.commentBefore = ruleComment(rule, language);
  } else {
    existing.value = value;
  }
  writeFileSync(path, String(doc), "utf8");
  return { ok: true, message: [text.done(rule.id, level, path), ...severityNote(rule, level, language)].join("\n") };
};

/** relax on a rule with nothing to count keeps its findings and lowers them; say so, or the change looks like it did nothing. */
const severityNote = (rule: RuleDefinition, level: Level, language: string): string[] => {
  if (level === "off") return [];
  const [from, to] = [severityAt(rule, "normal"), severityAt(rule, level)];
  if (from === to) return [];
  const ui = uiLanguageOf(language);
  return [TEXT[ui].severityMoved(SEVERITY_NAME[ui][from], SEVERITY_NAME[ui][to])];
};
