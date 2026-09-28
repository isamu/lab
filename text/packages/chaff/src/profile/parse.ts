import type { DocumentProfile } from "../plugin.ts";

/** profiles/*.yaml を一つ読んだもの。言語ごとの中身と、内容から選ぶための形を持つ。 */
export type ProfileDefinition = {
  readonly id: string;
  readonly name: Readonly<Record<string, string>>;
  readonly detect: Readonly<Record<string, ProfileDetect>>;
  readonly languages: Readonly<Record<string, DocumentProfile>>;
};

/** この形の行が minLines 行以上あれば、その種類の文書として読む。 */
type ProfileDetect = { readonly line: string; readonly minLines: number };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string" && entry !== "") : []);

const texts = (value: unknown): Record<string, string> =>
  isRecord(value) ? Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string")) : {};

/** 空でない文字列だけ。空の正規表現は何にでも当たる。 */
const text = (value: unknown): string | undefined => (typeof value === "string" && value !== "" ? value : undefined);

const detectOf = (value: unknown): ProfileDetect | undefined => {
  if (!isRecord(value) || typeof value["line"] !== "string") return undefined;
  const minLines = value["min_lines"];
  return { line: value["line"], minLines: typeof minLines === "number" && minLines > 0 ? minLines : 1 };
};

const LANGUAGE_KEYS = new Set(["id", "name", "why", "detect"]);

const languagesOf = (id: string, raw: Record<string, unknown>): Record<string, DocumentProfile> =>
  Object.fromEntries(
    Object.entries(raw)
      .filter(([key, value]) => !LANGUAGE_KEYS.has(key) && isRecord(value))
      .map(([language, value]) => {
        const section = isRecord(value) ? value : {};
        const addressEnd = text(section["address_end"]);
        const caption = text(section["caption"]);
        return [language, { id, addresses: strings(section["addresses"]), connectives: strings(section["connectives"]), addressEnd, caption }];
      }),
  );

/** id の無いものは読まない。どの設定から選ばれたのか言えなくなるため。 */
export const parseProfile = (raw: unknown): ProfileDefinition | undefined => {
  if (!isRecord(raw) || typeof raw["id"] !== "string" || raw["id"] === "") return undefined;
  const id = raw["id"];
  const detect = isRecord(raw["detect"])
    ? Object.fromEntries(
        Object.entries(raw["detect"]).flatMap(([language, value]) => {
          const found = detectOf(value);
          return found === undefined ? [] : [[language, found] as const];
        }),
      )
    : {};
  return { id, name: texts(raw["name"]), detect, languages: languagesOf(id, raw) };
};

/** 行頭から数える。source 全体に m フラグで当てれば、行ごとに分けずに数えられる。 */
export const detected = (definition: ProfileDefinition, source: string, language: string): boolean => {
  const detect = definition.detect[language];
  if (detect === undefined) return false;
  const count = [...source.matchAll(new RegExp(detect.line, "gmu"))].length;
  return count >= detect.minLines;
};
