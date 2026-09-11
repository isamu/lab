import type { LanguageAdapter } from "./plugin.ts";

const ADAPTER_PACKAGE: Readonly<Record<string, string>> = { ja: "@chaffjs/lang-ja", en: "@chaffjs/lang-en" };

const isAdapter = (value: unknown): value is LanguageAdapter => {
  if (typeof value !== "object" || value === null) return false;
  const record: Record<string, unknown> = { ...value };
  return record["kind"] === "language" && typeof record["id"] === "string" && typeof record["segment"] === "function";
};

const pickExport = (module: object): unknown => {
  const record: Record<string, unknown> = { ...module };
  return isAdapter(record["adapter"]) ? record["adapter"] : record["default"];
};

export const packageFor = (language: string): string | undefined => ADAPTER_PACKAGE[language];

/**
 * アダプタは「必要になったものだけ」を実行時に解決する。spec §17.2。
 * core だけで起動し、文字種で言語を当ててから、その言語のアダプタを読む。
 * 全言語を静的に import すると、使わない言語のぶんまで npx の初回取得が膨らむ。
 */
export const loadAdapter = async (language: string): Promise<LanguageAdapter> => {
  const specifier = packageFor(language);
  if (specifier === undefined) throw new Error(`no adapter for language "${language}"`);
  const module: unknown = await import(specifier);
  if (typeof module !== "object" || module === null) throw new Error(`${specifier} did not export a module`);
  const candidate = pickExport(module);
  if (!isAdapter(candidate)) throw new Error(`${specifier} does not export a LanguageAdapter`);
  return candidate;
};
