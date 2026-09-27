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

/**
 * 同梱の言語は表から、それ以外は `@chaffjs/lang-<言語>` を探す。
 * 利用者が lang-zh のようなパッケージを書いて入れれば、core を変えずにその言語で動く。
 */
const LANGUAGE_ID = /^[a-z]{2,3}$/u;

export const packageFor = (language: string): string | undefined =>
  ADAPTER_PACKAGE[language] ?? (LANGUAGE_ID.test(language) ? `@chaffjs/lang-${language}` : undefined);

/**
 * 探す順。公式（`@chaffjs/lang-<言語>`）が先で、無ければ第三者の `chaff-lang-<言語>`。
 * `@typescript-eslint/*` と `eslint-plugin-*` の分け方と同じで、README にもそう書いてある。同梱の言語は表のものだけ。
 */
export const packagesFor = (language: string): readonly string[] => {
  if (ADAPTER_PACKAGE[language] !== undefined) return [ADAPTER_PACKAGE[language]];
  return LANGUAGE_ID.test(language) ? [`@chaffjs/lang-${language}`, `chaff-lang-${language}`] : [];
};

export type Importer = (specifier: string) => Promise<unknown>;

/**
 * そのパッケージ自体が入っていないときだけ真。入っているパッケージが自分の依存を見つけられないときも同じ
 * ERR_MODULE_NOT_FOUND になるので、Node の文言が探した名前を挙げているかで分ける。
 */
export const isAbsent = (err: unknown, specifier: string): boolean =>
  err instanceof Error && "code" in err && err.code === "ERR_MODULE_NOT_FOUND" && err.message.includes(`'${specifier}'`);

/** 入っている最初のものを読む。入っていないのは次へ。入っていて壊れているものは、次へ行かずにそのまま投げる。 */
const importFirst = async (specifiers: readonly string[], language: string, importer: Importer): Promise<{ specifier: string; module: unknown }> => {
  const [first, ...rest] = specifiers;
  if (first === undefined) throw new Error(`no adapter for language "${language}"`);
  try {
    return { specifier: first, module: await importer(first) };
  } catch (err) {
    if (!isAbsent(err, first)) throw err;
    if (rest.length > 0) return importFirst(rest, language, importer);
    const all = packagesFor(language);
    const install = `npm i -D ${all[0] ?? first}`;
    // Only the requested language is known here; a Japanese message for Japanese, English for any other.
    const message =
      language === "ja"
        ? `言語 ${language} のパッケージが入っていません（${all.join(" か ")}。${install}）`
        : `No package for language ${language} is installed (${all.join(" or ")}; ${install})`;
    throw new Error(message, { cause: err });
  }
};

/**
 * アダプタは「必要になったものだけ」を実行時に解決する。spec §17.2。
 * core だけで起動し、文字種で言語を当ててから、その言語のアダプタを読む。
 * 全言語を静的に import すると、使わない言語のぶんまで npx の初回取得が膨らむ。
 */
export const loadAdapter = async (language: string, importer: Importer = (specifier) => import(specifier)): Promise<LanguageAdapter> => {
  const { specifier, module } = await importFirst(packagesFor(language), language, importer);
  if (typeof module !== "object" || module === null) throw new Error(`${specifier} did not export a module`);
  const candidate = pickExport(module);
  const broken = checkAdapter(candidate);
  if (broken !== undefined || !isAdapter(candidate)) throw new Error(`${specifier} が LanguageAdapter を export していません: ${broken ?? ""}`);
  return candidate;
};
