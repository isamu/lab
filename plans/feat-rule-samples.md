# feat: one sample per rule under text/docs/samples

## Goal

A reader who is not an engineer opens one page per rule and sees a short, realistic document, what chaff says
about it, the same document fixed, why it was a problem, and the settings that change the rule. The page should make
them want to run chaff on their own text.

## Layout

- `text/docs/samples/ja/<rule-id>.md` and `text/docs/samples/en/<rule-id>.md`, each written wholly in its language.
  A rule that runs in one language has a sample in that language only.
- `text/docs/samples/<ja|en>/README.md`: the index, generated. Samples by the rule reference's groups
  (`RULE_GROUPS`, `groupTextOf`), each with the rule's name and summary, then the rules of the group with no sample
  yet, so coverage is visible. The checks that read meaning (layer L4) are named apart: they run under `chaff test`.

## Sample format

- Opening comment `<!-- chaff-sample ... -->` holding YAML: `rule`, `genre`, optional `file` (the name the screen
  shows), optional `after_allows` (rules the corrected text may still trigger; the sample must say why).
- Fenced blocks tagged in the info string:
  - `chaff-before`, `chaff-after`: the two texts (use four backticks when the text holds a fence);
  - `chaff-config` (optional): chaff.yaml for both runs;
  - `chaff-file <name>` (optional): another document beside it, for rules that compare documents;
  - `chaff-output`: written by the generator, `npx chaffjs --no-guide --genre <genre> <file>` from the file's
    header to the closing line (the list of rules that did not run is left out: it grows with every rule);
  - `chaff-settings` (any number): chaff.yaml lines shown in the settings section;
  - `chaff-explain`: written by the generator, `npx chaffjs explain <rule> --genre <genre>`.
- Sections: title (name and id), one line on the documents it helps, Original, What chaff says, Corrected,
  How it was fixed, Settings.

## Generator

`scripts/samples.ts` (`yarn samples:update`, `yarn samples:check`): runs the command line on each sample in a fresh
folder (SARIF gives the reported rules), writes the two screens and the indexes. Pure parts in
`scripts/samples-parse.ts` and `scripts/samples-index.ts`. Runs fan out with `mapInChildren`.

## Test

`test/test_rule_samples.ts`, for every sample: the file is named after a rule that runs in that language as a lint;
the original is reported by that rule; the corrected text is reported by no rule except those in `after_allows`,
which the sample names; both screens equal what chaff prints now; every chaff.yaml block reads with no setting
warning and uses only keys the guide documents; the index matches the samples (its coverage lines are not compared,
so adding a rule does not touch it). `test/test_rule_samples_parse.ts` covers the parser.

## This round

The format, the generator, the test, the index, links from the READMEs, the skill and the getting-started pages,
and model samples in both languages across readability, consistency, wording, structure and AI-likeness rules.

## Later rounds

Fill the remaining rules, split by language and group so no two agents edit the same file (one file per rule;
the index is regenerated, and its coverage lines are not tested).
