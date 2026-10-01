// bin/chaff.js loads this before the CLI, on whatever Node.js the person has. Keep it free of imports and of syntax
// that old releases cannot parse (`??`, `?.`): running there is its whole job.

type Env = Readonly<Record<string, string | undefined>>;

/** The lowest major version an engines range such as ">=24" names, or undefined for a range of another shape. */
export const requiredMajorOf = (range: unknown): number | undefined => {
  const match = /^\s*>=\s*v?(\d+)/u.exec(String(range));
  return match === null ? undefined : Number(match[1]);
};

const isJapaneseLocale = (env: Env): boolean => /^ja/iu.test(env["LC_ALL"] || env["LC_MESSAGES"] || env["LANG"] || "");

/** What to print before stopping when this Node.js is older than the engines range; undefined when it is new enough. */
export const tooOldMessage = (version: string, range: unknown, env: Env): string | undefined => {
  const required = requiredMajorOf(range);
  const major = Number(version.split(".")[0]);
  if (required === undefined || Number.isNaN(major) || major >= required) return undefined;
  return isJapaneseLocale(env)
    ? `chaff は Node.js ${String(required)} 以上で動きます。いまは v${version} です。https://nodejs.org/ja から LTS を入れてください。`
    : `chaff needs Node.js ${String(required)} or later. This is v${version}. Install the LTS from https://nodejs.org/en`;
};
