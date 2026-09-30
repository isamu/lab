import type { DocumentProfile } from "../plugin.ts";
import { detected, type ProfileDefinition } from "./parse.ts";

/** 設定で書いた「使わない」。内容から選ぶのも止める。 */
export const NO_PROFILE = "none";

type ProfileSource = "by-path" | "config" | "genre" | "content";

export type ChosenProfile = { readonly profile: DocumentProfile; readonly from: ProfileSource };

export type ProfileRequest = {
  readonly byPath: string | undefined;
  readonly config: string | undefined;
  /** The profile the file's genre reads with (genres.yaml), when it names one. */
  readonly genre?: string | undefined;
  readonly source: string;
  readonly language: string;
};

const named = (definitions: readonly ProfileDefinition[], id: string, language: string): DocumentProfile | undefined =>
  definitions.find((definition) => definition.id === id)?.languages[language];

const writtenIn = (request: ProfileRequest): ProfileSource => {
  if (request.byPath !== undefined) return "by-path";
  return request.config === undefined ? "genre" : "config";
};

/**
 * 強いものから: by_path、chaff.yaml の profile、ジャンルの profile、内容。どれかが none と書けばそこで止め、内容からも選ばない。
 * 名前で選んだ種類にその言語の中身が無ければ選ばない。黙って別の種類にしない。
 */
export const chooseProfile = (definitions: readonly ProfileDefinition[], request: ProfileRequest): ChosenProfile | undefined => {
  const written = request.byPath ?? request.config ?? request.genre;
  if (written === NO_PROFILE) return undefined;
  if (written !== undefined) {
    const profile = named(definitions, written, request.language);
    return profile === undefined ? undefined : { profile, from: writtenIn(request) };
  }
  const found = definitions.find((definition) => detected(definition, request.source, request.language));
  const profile = found?.languages[request.language];
  return profile === undefined ? undefined : { profile, from: "content" };
};
