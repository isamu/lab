import { watch } from "node:fs";
import type { Finding } from "./plugin.ts";

/** 保存は 1 回でも複数イベントになる。まとめて 1 回だけ走らせる。 */
const SETTLE_MS = 120;

export type Snapshot = Readonly<Record<string, number>>;

export const snapshotOf = (findings: readonly Finding[]): Snapshot =>
  findings.reduce<Record<string, number>>((acc, finding) => ({ ...acc, [finding.rule]: (acc[finding.rule] ?? 0) + 1 }), {});

const total = (snapshot: Snapshot): number => Object.values(snapshot).reduce((sum, count) => sum + count, 0);

/**
 * 差分だけを出す。書いている最中に全件を出し直されると、何が変わったのか分からない。
 * workflow spec §11。
 */
export const describeChange = (before: Snapshot, after: Snapshot): string | undefined => {
  const rules = [...new Set([...Object.keys(before), ...Object.keys(after)])];
  const moved = rules
    .map((rule) => ({ rule, delta: (after[rule] ?? 0) - (before[rule] ?? 0) }))
    .filter((entry) => entry.delta !== 0)
    .sort((left, right) => left.rule.localeCompare(right.rule, "en"));
  if (moved.length === 0) return undefined;
  const detail = moved.map((entry) => `${entry.delta > 0 ? "+" : ""}${entry.delta} ${entry.rule}`).join(", ");
  const mark = total(after) < total(before) ? "✓" : "✗";
  return `${mark} ${total(before)} → ${total(after)} 件   (${detail})`;
};

export const clock = (): string => new Date().toTimeString().slice(0, 8);

/** 変更が落ち着いてから 1 度だけ呼ぶ。 */
export const watchPaths = (paths: readonly string[], onChange: (path: string) => void): (() => void) => {
  const timers = new Map<string, NodeJS.Timeout>();
  const watchers = paths.map((path) =>
    watch(path, () => {
      const pending = timers.get(path);
      if (pending !== undefined) clearTimeout(pending);
      timers.set(
        path,
        setTimeout(() => {
          timers.delete(path);
          onChange(path);
        }, SETTLE_MS),
      );
    }),
  );
  return (): void => {
    timers.forEach((timer) => clearTimeout(timer));
    watchers.forEach((watcher) => watcher.close());
  };
};
