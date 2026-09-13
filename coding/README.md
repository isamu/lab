# coding

The workspace that builds **scoria**, a code quality assay harness for TypeScript and JavaScript.

```
packages/scoria/   the published package        docs/            how it was decided and measured
test/              its tests, by concern        scoria-spec.md   the design, and why
```

## What scoria does

It reads a repository, runs a fixed set of measurements over it, and reports a score per dimension
with the findings behind each one. It brings its own ruleset rather than reading the project's, so a
repository that has turned every rule off does not score well for it.

Nine dimensions, from thirteen probes:

| dimension        | asks                                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------ |
| `correctness`    | does the code do what it looks like it does — errors oxlint denies outright                            |
| `readability`    | can it be read: file sizes, duplication, lint smells                                                   |
| `type-safety`    | `tsc` against the project's own config, and how much is not typed at all                               |
| `architecture`   | code and dependencies nothing reaches, and modules importing in circles                                |
| `security`       | known advisories, from the project's own package manager                                               |
| `test-coverage`  | how much test code there is, and coverage where a report exists                                        |
| `documentation`  | is there a README, and does it still list the flags the program accepts                                |
| `ui-consistency` | how many _distinct_ colours and spacing values the components use                                      |
| `integrity`      | whether the measurement itself can be trusted — suppressions, missing gates, CI that swallows failures |

`integrity` is the one that is different in kind. Where suppressions are dense, the other numbers are
not high — they are unmeasured, and the report says so by lowering their confidence rather than only
their score.

A dimension nothing could be measured in reports `—`, never a number standing in for it. Scores are
**not comparable between repositories**: what normalises, which probes could run, and what each
rubric weighs all differ. Only one repository's own trend means anything, which is what the baseline
is for.

## Running it

```bash
npx scoria                  # measure this directory
npx scoria baseline         # record this run, so later ones report the change
npx scoria doctor           # what the project's own gates are missing
npx scoria explain readability
```

| flag                    |                                                                           |
| ----------------------- | ------------------------------------------------------------------------- |
| `--json`                | the whole report to stdout                                                |
| `--explain <dimension>` | the metrics behind one dimension and what each is worth                   |
| `--sarif <path>`        | findings as SARIF, for GitHub's Security tab and inline on a pull request |
| `--badge-json <path>`   | a shields.io endpoint badge, needing no server                            |
| `--lang ja`             | Japanese terminal output; machine output stays English                    |
| `--fix`                 | with `doctor`, apply the fixes that need no judgement                     |
| `--no-write`            | never create a config file                                                |
| `--no-summary`          | do not write the GitHub job summary                                       |

Configuration is `scoria.config.json`, or `extensions.scoria` in a
[`repo.json`](https://github.com/repos-json/repos-json). `targets` names the directories to measure
when a repository holds more than one project; `mode: ratchet` fails the run when a dimension falls
below its baseline.

## Working on it

```bash
yarn install
yarn format && yarn lint && yarn typecheck && yarn build && yarn test
yarn test:coverage          # writes coverage/lcov.info, which scoria then reads
```

Every gate has to pass, and the repository measures itself on every change — the `quality` workflow
runs scoria over both workspaces and writes the report into the run's job summary.

## Reading further

- **[docs/guide.md](docs/guide.md) — start here** ([日本語](docs/guide.ja.md)): what it is, how to
  run it, and how to read what it says
- [packages/scoria/README.md](packages/scoria/README.md) — the full documentation
  ([日本語](packages/scoria/README.ja.md))
- [scoria-spec.md](scoria-spec.md) — the design, in Japanese, including the decisions that were
  reversed and why
- [docs/calibration.md](docs/calibration.md) — what the scales actually do, measured across 49
  repositories
- [docs/the-original-list.md](docs/the-original-list.md) — every tool that was asked for, and
  whether it is measured or closed with a reason
- [docs/ChangeLog.md](docs/ChangeLog.md)
