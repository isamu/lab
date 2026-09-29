import { NO_PROFILE } from "./select.ts";

/** Where a profile was set: chaff.yaml's profile, or one of its by_path entries. */
export type ProfileSetting = "config" | "by_path";

type UnknownProfile = {
  readonly where: ProfileSetting;
  readonly profile: string;
  /** The by_path entry's files, so the message can say which entry; empty for chaff.yaml's profile. */
  readonly files: readonly string[];
};

type PathProfile = { readonly files: readonly string[]; readonly profile?: string | undefined };

type WrittenProfiles = { readonly config: string | undefined; readonly byPath: readonly PathProfile[] };

/** Commands that never read a document, so never choose a profile. A wrong one in chaff.yaml must not stop them. */
const PROFILE_FREE: ReadonlySet<string> = new Set(["init", "genres", "skill", "relax", "strict", "off", "rules", "explain"]);

/** The profiles a command would read from chaff.yaml: none for a command that reads no document. */
export const writtenProfiles = (command: string, config: { readonly profile: string | undefined; readonly byPath: readonly PathProfile[] }): WrittenProfiles =>
  PROFILE_FREE.has(command) ? { config: undefined, byPath: [] } : { config: config.profile, byPath: config.byPath };

const setting = (where: ProfileSetting, profile: string | undefined, files: readonly string[] = []): UnknownProfile[] =>
  profile === undefined ? [] : [{ where, profile, files }];

/**
 * Every profile a setting names that is neither a bundled one nor none. Such a name chooses nothing and also stops the choice from the content,
 * so it silently acts as none. All of them, not only the one a file would use, because a wrong setting is wrong for every file.
 */
export const unknownProfiles = (written: WrittenProfiles, known: readonly string[]): UnknownProfile[] =>
  [...setting("config", written.config), ...written.byPath.flatMap((entry) => setting("by_path", entry.profile, entry.files))].filter(
    (entry) => entry.profile !== NO_PROFILE && !known.includes(entry.profile),
  );
