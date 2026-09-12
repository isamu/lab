import type { LanguageAdapter } from "./plugin.ts";

const ADAPTER_PACKAGE: Readonly<Record<string, string>> = { ja: "@chaffjs/lang-ja", en: "@chaffjs/lang-en" };

/** core が読める契約の版。合わないアダプタは、動かしてから壊れるより先に断る。 */
const API_VERSION = 1;

const isCapabilities = (value: unknown): boolean => {
  if (typeof value !== "object" || value === null) return false;
  const record: Record<string, unknown> = { ...value };
  const unit = record["lengthUnit"];
  return (
    record["sentenceSplit"] === true && (unit === "char" || unit === "word") && ["wordSplit", "pos", "lemma"].every((name) => typeof record[name] === "boolean")
  );
};

/**
 * 形だけを見る。中身が正しいかは動かさないと分からないが、**形が違うものを通すと
 * 指摘 0 件で終わる**。0 件は「問題なし」と見分けがつかない。
 */
const isAdapter = (value: unknown): value is LanguageAdapter => {
  if (typeof value !== "object" || value === null) return false;
  const record: Record<string, unknown> = { ...value };
  return (
    record["kind"] === "language" &&
    typeof record["id"] === "string" &&
    record["id"] !== "" &&
    record["apiVersion"] === API_VERSION &&
    typeof record["segment"] === "function" &&
    typeof record["detect"] === "function" &&
    isCapabilities(record["capabilities"])
  );
};

/**
 * 形が違うときに、どこが違うのかを返す。満たしていれば undefined。
 * 「読めません」だけでは、アダプタを書いた人が直せない。
 */
export const checkAdapter = (value: unknown): string | undefined => {
  if (isAdapter(value)) return undefined;
  if (typeof value !== "object" || value === null) return "object ではありません";
  const record: Record<string, unknown> = { ...value };
  if (record["apiVersion"] !== API_VERSION) return `apiVersion が ${String(record["apiVersion"])} です（core は ${String(API_VERSION)}）`;
  if (!isCapabilities(record["capabilities"])) return "capabilities の形が違います";
  return "kind / id / segment / detect のどれかがありません";
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
  const broken = checkAdapter(candidate);
  if (broken !== undefined || !isAdapter(candidate)) throw new Error(`${specifier} が LanguageAdapter を export していません: ${broken ?? ""}`);
  return candidate;
};
