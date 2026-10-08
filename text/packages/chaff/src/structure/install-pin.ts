// An install command that pins the document's own package (npm install wrapkit@3.1.0) to a version other than the one its
// release list says is current. Pure: reads the source, the releases the document lists, and the install command shapes.
import { escapeRegExp } from "../orthography.ts";

/** One release the document lists: a version heading with its section, or a list item that starts with a version. */
export type Release = { readonly version: string; readonly start: number; readonly end: number };

/** A package pinned to one exact version by an install command. */
export type Pin = { readonly offset: number; readonly name: string; readonly version: string };

/** Where the document names itself: its title, and the paragraph that opens it. */
export type OwnText = { readonly title: string; readonly opening: string };

export type PinIssue = {
  readonly offset: number;
  readonly variant: "newest" | "section";
  readonly values: { readonly pinned: string; readonly release: string };
};

const NAME = "(@?[A-Za-z0-9][\\w.\\/-]*)";
/** Exactly one version: not a range (^3.0.0, >=3.0.0), not a prerelease or build (3.0.0-beta.1), not a tag (latest). */
const EXACT_VERSION = "(\\d{1,4}\\.\\d{1,4}\\.\\d{1,4})(?![\\w.+-])";
/** The rest of a command: on its line, up to a ; && | or a closing backtick. */
const COMMAND_REST = "[^\\n;&|`]*";

/** A lexicon shape ("npm install {name}@{version}") as the command and the pin it takes. */
export type InstallShape = { readonly command: RegExp; readonly pin: RegExp };

/** A shape read from the lexicon; undefined when it does not name a command, then both parts in that order. */
export const installShape = (shape: string): InstallShape | undefined => {
  const [command = "", rest = ""] = shape.split("{name}");
  const [separator, tail] = rest.split("{version}");
  if (command.trim() === "" || separator === undefined || tail === undefined) return undefined;
  const words = command.trim().split(/\s+/u).map(escapeRegExp).join("[ \\t]+");
  const pin = escapeRegExp(separator).replaceAll(" ", "[ \\t]+");
  return {
    command: new RegExp(`(?<![\\w.-])${words}(?=[ \\t])${COMMAND_REST}`, "gu"),
    pin: new RegExp(`(?<=[ \\t])${NAME}${pin}${EXACT_VERSION}`, "gu"),
  };
};

const pinsAfter = (command: RegExpExecArray, shape: InstallShape): Pin[] =>
  [...command[0].matchAll(shape.pin)].flatMap((match) => {
    const [whole, name, version] = match;
    if (name === undefined || version === undefined) return [];
    return [{ offset: command.index + match.index + whole.length - version.length, name, version }];
  });

/** Each pin an install command makes, read with the lexicon's command shapes. Flags and other packages may come first. */
export const pinsIn = (source: string, shapes: readonly string[]): Pin[] =>
  shapes
    .flatMap((text) => {
      const shape = installShape(text);
      return shape === undefined ? [] : [...source.matchAll(shape.command)].flatMap((command) => pinsAfter(command, shape));
    })
    .filter((pin, index, pins) => pins.findIndex((other) => other.offset === pin.offset) === index);

const names = (text: string, name: string): boolean => {
  const bare = name.slice(name.lastIndexOf("/") + 1);
  return [name, bare].some((candidate) => new RegExp(`(?<![\\w@/.-])${escapeRegExp(candidate)}(?![\\w-])`, "iu").test(text));
};

/**
 * The pins of the document's own package: those its title names, or, when the title names none (a changelog titled
 * "Changelog"), those its opening paragraph names. Another package pinned in the same document is a dependency.
 */
const ownPins = (pins: readonly Pin[], own: OwnText): Pin[] => {
  const titled = pins.filter((pin) => names(own.title, pin.name));
  return titled.length > 0 ? titled : pins.filter((pin) => names(own.opening, pin.name));
};

const PARAGRAPH_BREAK = /\n[ \t]*\n/u;

/** The document's title, its first top-level heading, and the paragraph that opens the text after it. */
export const ownTextOf = (source: string, headings: readonly { readonly depth: number; readonly text: string; readonly end: number }[]): OwnText => {
  const title = headings.find((heading) => heading.depth === 1);
  const rest = source.slice(title?.end ?? 0).trimStart();
  const opening = rest.startsWith("#") ? "" : (rest.split(PARAGRAPH_BREAK)[0] ?? "");
  return { title: title?.text ?? "", opening };
};

const partsOf = (version: string): number[] => version.split(".").map(Number);

const isNewer = (left: string, right: string): boolean => {
  const [a, b] = [partsOf(left), partsOf(right)];
  const differing = a.findIndex((part, index) => part !== b[index]);
  return differing !== -1 && (a[differing] ?? 0) > (b[differing] ?? 0);
};

/** The newest release by version order; a prerelease (4.0.0-beta.1) is not the one a reader is told to install. */
const newestOf = (releases: readonly Release[]): string | undefined =>
  releases
    .map((release) => release.version)
    .filter((version) => !version.includes("-"))
    .reduce<string | undefined>((newest, version) => (newest === undefined || isNewer(version, newest) ? version : newest), undefined);

/** The release whose section holds a position, innermost first: a pin under "## 3.2.0" belongs to 3.2.0. */
const sectionAt = (releases: readonly Release[], offset: number): Release | undefined =>
  releases.filter((release) => release.start <= offset && offset < release.end).at(-1);

/**
 * Each pin of the document's own package that differs from its release: the release whose section it is in, or else the
 * newest the document lists. A document that lists no release says nothing to compare.
 */
export const installPinMismatches = (pins: readonly Pin[], releases: readonly Release[], own: OwnText): PinIssue[] => {
  const newest = newestOf(releases);
  if (newest === undefined) return [];
  return ownPins(pins, own).flatMap((pin) => {
    const section = sectionAt(releases, pin.offset);
    const release = section?.version ?? newest;
    if (release === pin.version) return [];
    return [{ offset: pin.offset, variant: section === undefined ? "newest" : "section", values: { pinned: pin.version, release } }];
  });
};
