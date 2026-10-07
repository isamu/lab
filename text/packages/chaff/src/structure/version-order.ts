import type { StructureIssue } from "./issues.ts";

/**
 * Versions listed in order, a changelog's headings or a list of releases, with one out of place. The direction (newest or
 * oldest first) is taken from most of the steps, and a version that fits in no longest run along it is pointed out.
 */
export type VersionPoint = { readonly offset: number; readonly label: string };

type Version = { readonly parts: readonly number[]; readonly prerelease: string };

/** A version at the start of a heading or an item: 3.2.0, v3.2.0, [3.2.0], 3.2.0-beta.1. */
const VERSION_START = /^\[?v?(\d{1,4})\.(\d{1,4})\.(\d{1,4})(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?\]?(?![\w.])/u;

/** The version a heading or an item starts with, as written; undefined when it does not start with one. */
export const leadingVersion = (text: string): string | undefined => VERSION_START.exec(text.trim())?.[0];

const parse = (label: string): Version | undefined => {
  const match = VERSION_START.exec(label);
  if (match === null) return undefined;
  return { parts: [match[1], match[2], match[3]].map(Number), prerelease: match[4] ?? "" };
};

/** A prerelease (3.0.0-beta.1) comes before its release (3.0.0). */
const comparePrerelease = (left: string, right: string): number => {
  if (left === right) return 0;
  if (left === "") return 1;
  return right === "" ? -1 : Math.sign(left.localeCompare(right, "en", { numeric: true }));
};

const compareVersions = (left: Version, right: Version): number => {
  const differing = left.parts.findIndex((part, index) => part !== right.parts[index]);
  return differing === -1 ? comparePrerelease(left.prerelease, right.prerelease) : Math.sign((left.parts[differing] ?? 0) - (right.parts[differing] ?? 0));
};

/** The longest run along direction ending at each version (equal versions do not break it). */
const longestEndingAt = (versions: readonly Version[], direction: number): number[] =>
  versions.reduce<number[]>((lengths, version, index) => {
    const along = versions.slice(0, index).map((earlier, at) => (compareVersions(version, earlier) === -direction ? 0 : (lengths[at] ?? 0)));
    return [...lengths, 1 + Math.max(0, ...along)];
  }, []);

const majorityOf = (versions: readonly Version[]): number =>
  Math.sign(versions.slice(1).reduce((sum, version, index) => sum + compareVersions(version, versions[index] ?? version), 0));

/** The fewest versions an order is read from: with two, either one could be the one out of place. */
const MIN_VERSIONS = 3;

/**
 * The versions that belong to no longest run along the majority direction. A run that holds no more than half of them is
 * taken as sorted by something else, and nothing is said.
 */
export const versionOrderBreaks = (points: readonly VersionPoint[]): StructureIssue[] => {
  const parsed = points.flatMap((point) => {
    const version = parse(point.label);
    return version === undefined ? [] : [{ point, version }];
  });
  const versions = parsed.map((entry) => entry.version);
  const direction = majorityOf(versions);
  if (versions.length < MIN_VERSIONS || direction === 0) return [];
  const forward = longestEndingAt(versions, direction);
  const backward = longestEndingAt(versions.toReversed(), -direction).toReversed();
  const longest = Math.max(...forward);
  if (longest * 2 <= versions.length) return [];
  return parsed.flatMap((entry, index) =>
    (forward[index] ?? 0) + (backward[index] ?? 0) - 1 === longest
      ? []
      : [{ offset: entry.point.offset, values: { version: entry.point.label, previous: parsed[index - 1]?.point.label ?? "" } }],
  );
};

/** A version whose last part is zero (3.1.0) is no section number: the sections under 3.1 count from 3.1.1. */
const endsInZero = (version: Version): boolean => version.parts.at(-1) === 0;

/**
 * Whether dotted labels (1.2.1, 1.2.2) are a version history rather than section numbers: all of them versions, and
 * either one ends in zero or most steps go down (newest first). Section numbers only go up. version-order checks the
 * histories and numbering-gap the rest, so a sequence is never reported by both.
 */
export const isVersionHistory = (labels: readonly string[]): boolean => {
  const versions = labels.map(parse);
  const parsed = versions.filter((version) => version !== undefined);
  if (labels.length < 2 || parsed.length !== labels.length) return false;
  return parsed.some(endsInZero) || majorityOf(parsed) < 0;
};
