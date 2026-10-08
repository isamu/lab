import type { DocumentProfile, RelativeVocabulary } from "../plugin.ts";

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

const unitsOf = (value: unknown): Record<string, number> =>
  isRecord(value) ? Object.fromEntries(Object.entries(value).filter((entry): entry is [string, number] => entry[0] !== "" && Number.isInteger(entry[1]))) : {};

const asideOf = (value: unknown): RelativeVocabulary["aside"] => {
  if (!isRecord(value)) return undefined;
  const [open, close] = [text(value["open"]), text(value["close"])];
  return open === undefined || close === undefined ? undefined : { open, close };
};

/** 括弧の開き・閉じと、目印が一つも無ければ読まない。 */
const substitutionOf = (value: unknown): RelativeVocabulary["substitution"] => {
  if (!isRecord(value)) return undefined;
  const [open, close] = [text(value["open"]), text(value["close"])];
  const [after, before] = [strings(value["after"]), strings(value["before"])];
  return open === undefined || close === undefined || after.length + before.length === 0
    ? undefined
    : { open, close, after, before, document: text(value["document"]) };
};

/** 字下げと、どの種類の中か、どの深さかのどれかが無ければ読まない。 */
const unnumberedOf = (value: unknown): DocumentProfile["unnumbered"] => {
  if (!isRecord(value)) return undefined;
  const [indent, inside, depth] = [text(value["indent"]), text(value["inside"]), value["depth"]];
  return indent === undefined || inside === undefined || !Number.isInteger(depth) || typeof depth !== "number" ? undefined : { indent, inside, depth };
};

/** 単位が一つも無ければ読まない。何を指すのか決められない。 */
const relativeOf = (value: unknown): RelativeVocabulary | undefined => {
  if (!isRecord(value)) return undefined;
  const units = unitsOf(value["units"]);
  if (Object.keys(units).length === 0) return undefined;
  return {
    before: strings(value["before"]),
    after: strings(value["after"]),
    same: strings(value["same"]),
    current: strings(value["current"]),
    every: strings(value["every"]),
    count: text(value["count"]) ?? "(?!)",
    units,
    suffixPrefix: text(value["suffix_prefix"]) ?? "",
    implicitFirst: typeof value["implicit_first"] === "string" ? units[value["implicit_first"]] : undefined,
    notAfter: text(value["not_after"]),
    substitution: substitutionOf(value["substitution"]),
    inside: strings(value["inside"]).filter((unit) => units[unit] !== undefined),
    joiners: strings(value["joiners"]),
    aside: asideOf(value["aside"]),
  };
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
        const relative = relativeOf(section["relative"]);
        const unnumbered = unnumberedOf(section["unnumbered"]);
        return [
          language,
          {
            id,
            addresses: strings(section["addresses"]),
            connectives: strings(section["connectives"]),
            addressEnd,
            caption,
            relative,
            unnumbered,
            ...(section["quote_mentions_term"] === true ? { quoteMentionsTerm: true } : {}),
          },
        ];
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
