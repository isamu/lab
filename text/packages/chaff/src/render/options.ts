import type { OptionValue, RuleDefinition } from "../plugin.ts";
import { DEFAULT_SOURCE, settleOptions, type OptionLayer } from "../rule-options.ts";
import { localized } from "./text.ts";
import type { Texts } from "../ui.ts";
import { uiLanguageOf } from "../ui.ts";

const printed = (value: OptionValue): string => (Array.isArray(value) ? `[${value.join(", ")}]` : String(value));

/** A rule's options for rules --json: what each decides, what it may be, its default, its value now and which setting gave it. */
export const optionsJson = (rule: RuleDefinition, layers: readonly OptionLayer[]): Record<string, unknown> | undefined => {
  if (rule.options === undefined) return undefined;
  const settled = settleOptions(rule.id, rule.options, layers);
  return Object.fromEntries(
    Object.entries(rule.options).map(([name, option]) => [
      name,
      {
        kind: option.kind,
        about: option.about,
        ...(option.kind === "choice" ? { choices: option.choiceNames } : {}),
        default: option.default,
        now: settled[name]?.value ?? option.default,
        from: settled[name]?.from ?? DEFAULT_SOURCE,
      },
    ]),
  );
};

const TEXT: Texts<{ readonly heading: string; readonly byDefault: string; readonly from: (source: string) => string; readonly howTo: (id: string) => string }> =
  {
    ja: {
      heading: "オプション（chaff.yaml の options で決めます）:",
      byDefault: "既定",
      from: (source) => `${source} から`,
      howTo: (id) => `決める:  chaff.yaml に options: { ${id}: { <名前>: <値> } } を書く`,
    },
    en: {
      heading: "Options (set under options in chaff.yaml):",
      byDefault: "default",
      from: (source) => `from ${source}`,
      howTo: (id) => `Set one:  write options: { ${id}: { <name>: <value> } } in chaff.yaml`,
    },
  };

/** A rule's options for explain: each one's value now and where it came from, what it decides, and each choice's meaning. */
export const optionLines = (rule: RuleDefinition, layers: readonly OptionLayer[], language: string): string[] => {
  if (rule.options === undefined) return [];
  const text = TEXT[uiLanguageOf(language)];
  const settled = settleOptions(rule.id, rule.options, layers);
  const lines = Object.entries(rule.options).flatMap(([name, option]) => {
    const now = settled[name];
    const source = now === undefined || now.from === DEFAULT_SOURCE ? text.byDefault : text.from(now.from);
    const choices = Object.entries(option.choiceNames).map(
      ([choice, meaning]) => `      ${choice === now?.value ? "→" : " "} ${choice.padEnd(11)}${localized(meaning, language)}`,
    );
    return [`    ${name}: ${printed(now?.value ?? option.default)}   (${source})`, `      ${localized(option.about, language)}`, ...choices];
  });
  return ["", `  ${text.heading}`, ...lines, "", `  ${text.howTo(rule.id)}`];
};
