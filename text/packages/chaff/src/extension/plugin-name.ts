import { isAbsolute } from "node:path";

// The names a plugin goes by. A package is chaff-plugin-<name> or @scope/chaff-plugin-<name>, and its rules are named
// <name>/<rule> or @scope/<name>/<rule>, so they cannot take a built-in rule's id or another plugin's. Pure.

/** A plugin's name, the prefix of its ids: foo, @scope/foo, or @scope for @scope/chaff-plugin. */
const PLUGIN_NAME = /^(?:@[a-z0-9][a-z0-9._-]*(?:\/[a-z][a-z0-9-]*)?|[a-z][a-z0-9-]*)$/u;

const PACKAGE = /^(?:(@[a-z0-9][a-z0-9._-]*)\/)?chaff-plugin(?:-([a-z][a-z0-9-]*))?$/u;

/** A rule id as chaff.yaml, stet and baseline may write it: a built-in or team id, or a plugin's id with its prefix. */
export const RULE_ID = /^(?:@[a-z0-9][a-z0-9._-]*\/)?(?:[a-z][a-z0-9-]*\/)?[a-z][a-z0-9-]*$/u;

export const isPluginName = (name: string): boolean => PLUGIN_NAME.test(name);

/** The name a plugin package must declare: chaff-plugin-foo → foo, @scope/chaff-plugin-foo → @scope/foo. undefined for a name that is not a plugin package's. */
export const pluginNameOfPackage = (packageName: string): string | undefined => {
  const match = PACKAGE.exec(packageName);
  if (match === null) return undefined;
  const [, scope, name] = match;
  if (scope === undefined) return name;
  return name === undefined ? scope : `${scope}/${name}`;
};

/** A path to a plugin of the project's own (./local-plugin), rather than a package's name. */
export const isPluginPath = (written: string): boolean => written.startsWith(".") || isAbsolute(written);
