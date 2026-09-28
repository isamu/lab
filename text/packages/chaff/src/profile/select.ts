import type { DocumentProfile } from "../plugin.ts";
import { detected, type ProfileDefinition } from "./parse.ts";

/** 設定で書いた「使わない」。内容から選ぶのも止める。 */
export const NO_PROFILE = "none";

type ProfileSource = "by-path" | "config" | "content";

export type ChosenProfile = { readonly profile: DocumentProfile; readonly from: ProfileSource };

export type ProfileRequest = {
  readonly byPath: string | undefined;
  readonly config: string | undefined;
  readonly source: string;
  readonly language: string;
};

const named = (definitions: readonly ProfileDefinition[], id: string, language: string): DocumentProfile | undefined =>
  definitions.find((definition) => definition.id === id)?.languages[language];

/**
 * 強いものから: by_path、chaff.yaml の profile、内容。どれかが none と書けばそこで止め、内容からも選ばない。
 * 名前で選んだ種類にその言語の中身が無ければ選ばない。黙って別の種類にしない。
 */
export const chooseProfile = (definitions: readonly ProfileDefinition[], request: ProfileRequest): ChosenProfile | undefined => {
  const written = request.byPath ?? request.config;
  if (written === NO_PROFILE) return undefined;
  if (written !== undefined) {
    const profile = named(definitions, written, request.language);
    return profile === undefined ? undefined : { profile, from: request.byPath === undefined ? "config" : "by-path" };
  }
  const found = definitions.find((definition) => detected(definition, request.source, request.language));
  const profile = found?.languages[request.language];
  return profile === undefined ? undefined : { profile, from: "content" };
};
