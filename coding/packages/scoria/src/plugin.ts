/**
 * scoria plugin contract — spec §8.
 *
 * このファイルは型だけを持つ。実装を足さないこと。
 * probe と stack adapter はここだけに依存し、core の内部を知らない。
 */

export type Tier = 0 | 1 | 2 | 3 | 4 | 5;

export type Severity = "error" | "warning" | "info";

export type MetricUnit = "count" | "ratio" | "per_kloc" | "pct" | "lines";

export interface Contributor {
  readonly file: string;
  readonly value: number;
}

/**
 * probe が返す 1 本の測定値。点ではない（spec §6.2）。
 * 0-100 の正規化は rubric の仕事であり、probe が行うと閾値が probe に埋まる。
 */
export interface Metric {
  readonly id: string;
  readonly value: number;
  readonly unit: MetricUnit;
  readonly topContributors?: readonly Contributor[];
}

/**
 * absent と skipped を分けるのは、テストが 1 本も無い repo が満点を取るのを防ぐため（spec §18）。
 * absent はそのプロジェクトが本来持つべきものが無い状態で、0 点として採点する。
 * skipped は scoria 側の都合で測れなかった状態で、採点しない。
 */
export type ProbeStatus =
  { readonly kind: "ok" } | { readonly kind: "absent"; readonly reason: string } | { readonly kind: "skipped"; readonly reason: string };

export interface Finding {
  readonly rule: string;
  readonly severity: Severity;
  readonly file: string;
  readonly line: number;
  readonly message: string;
  readonly probe: string;
  readonly dimension: string;
  readonly tier: Tier;
}

export interface ProbeResult {
  readonly probe: string;
  readonly status: ProbeStatus;
  readonly metrics: readonly Metric[];
  readonly findings: readonly Finding[];
  readonly toolVersions: Readonly<Record<string, string>>;
  readonly durationMs: number;
}

export type FileKind = "source" | "test" | "config" | "generated" | "ignored";

/**
 * probe には分類済みのファイルだけを渡す。生のパスは渡さない。
 * spec §8 は probe が classify 以外でファイル種別を判定することを禁じているが、
 * それを静的検査で守るのではなく、契約の形で守る。
 */
export interface SourceFile {
  readonly path: string;
  readonly kind: FileKind;
  readonly lines: readonly string[];
}

export interface ExecResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly code: number;
}

export type Exec = (command: string, args: readonly string[]) => Promise<ExecResult>;

export interface ProbeContext {
  readonly root: string;
  readonly files: readonly SourceFile[];
  readonly exec: Exec;
}

export interface Probe {
  readonly kind: "probe";
  readonly id: string;
  readonly apiVersion: 1;
  readonly tier: Tier;
  /** この probe が出しうる metric id。rubric の静的検証に使う（spec §26.2） */
  readonly declares: readonly string[];
  readonly detect: (ctx: ProbeContext) => Promise<ProbeStatus>;
  readonly run: (ctx: ProbeContext) => Promise<ProbeResult>;
}

export interface StackDetection {
  readonly matched: boolean;
  readonly confidence: number;
  readonly evidence: readonly string[];
}

export interface StackAdapter {
  readonly kind: "stack";
  readonly id: string;
  readonly apiVersion: 1;
  readonly detect: (root: string) => Promise<StackDetection>;
  readonly classify: (relativePath: string) => FileKind;
}
