import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { Scalar, YAMLMap, isMap, isScalar, parseDocument, type Document } from "yaml";
import { definedLevels } from "../levels.ts";
import { localized } from "../render/text.ts";
import type { Level, RuleDefinition } from "../plugin.ts";

const TEMPLATE = `# chaff.yaml — このチームの文章規範
#
# ここに書くのは「既定から変えたもの」だけです。
# 値は strict / normal / relaxed / off の 4 つから選びます。数字は要りません。

rules:
`;

export type ChangeOutcome = { readonly ok: boolean; readonly message: string };

const today = (): string => new Date().toISOString().slice(0, 10);

const reasonOf = (value: unknown): string | undefined => {
  if (!isScalar(value) || typeof value.comment !== "string") return undefined;
  const text = value.comment.trim();
  return text.length === 0 ? undefined : text;
};

const ruleComment = (rule: RuleDefinition, language: string): string => ` ${localized(rule.name, language)}\n ${localized(rule.why, language)}`;

const load = (path: string): Document => parseDocument(existsSync(path) ? readFileSync(path, "utf8") : TEMPLATE);

/**
 * 設定を機械的に書き換えるが、**既存のコメントを壊さない**。
 * 設定ファイルがチームの規範そのものである以上、コメントが失われることは規範が失われること。
 * spec §19.4。
 */
export const applyLevel = (path: string, rule: RuleDefinition, level: Level, why: string | undefined, language: string, who: string): ChangeOutcome => {
  if (!definedLevels(rule).includes(level)) {
    return { ok: false, message: `${rule.id} に ${level} はありません。normal と同じ設定です。\n設定は変更しませんでした。` };
  }
  const doc = load(path);
  const rules = doc.get("rules");
  const map = isMap(rules) ? rules : new YAMLMap();
  // 人が読んで書き足すファイルなので、必ず block style にする。flow style（{ a: b }）は読めない。
  map.flow = false;
  if (!isMap(rules)) doc.set("rules", map);
  const existing = map.items.find((pair) => String(pair.key) === rule.id);
  const previous = reasonOf(existing?.value);
  // 古い理由が新しい値に付いたまま残ると、履歴が嘘になる。
  if (previous !== undefined && why === undefined) {
    return { ok: false, message: `${rule.id} には既に理由が書かれています:\n  ${previous}\n値を変えるときは --why で新しい理由を書いてください。` };
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
  return { ok: true, message: `${rule.id} を ${level} にしました（${path}）` };
};
