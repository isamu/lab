# scoria

A code quality assay harness for TypeScript and JavaScript.

It collects machine evidence about a repository, normalises it through a fixed rubric, and reports
per-dimension scores — so that improvement and regression are visible over time.

Design spec (Japanese): [scoria-spec.md](./scoria-spec.md) · 日本語の README: [README.ja.md](./README.ja.md)

This is still a **walking skeleton**: three probes, no external tool integration, and every
dimension is `experimental`.

## Use it

### In your project, with npx

```bash
cd your-project
npx scoria
```

With no argument it measures the current directory.

### As a package script

```bash
yarn add --dev scoria
```

```json
{
  "scripts": {
    "quality": "scoria"
  }
}
```

```bash
yarn quality
```

### From source, before publishing

Build a tarball and run it in the target repository. Nothing is installed there.

```bash
cd lab/coding
yarn install && yarn build
cd packages/scoria && npm pack --pack-destination /tmp

cd your-project
npx --package=/tmp/scoria-0.1.0.tgz -- scoria
```

## Configuration

The first run writes `scoria.config.json`. To create it explicitly, run `scoria init`.

```json
{
  "profile": "app",
  "stacks": ["vue", "ts"],
  "mode": "report",
  "lang": "en"
}
```

`profile` and `stacks` are detected from `package.json`: vue / nuxt → vue, react / next → react,
`bin` → cli, published `exports` → library.

**Detection is frozen there.** Adding a dependency does not silently change it; a disagreement is
reported as detection drift and nothing more. A measurement that changes between runs cannot be
compared over time (spec §9.2). Run `scoria init` again to adopt a change deliberately.

The same object may live under a `scoria` key in `package.json` instead.

If the project runs Prettier over JSON, add these to `.prettierignore`:

```
.scoria/
scoria.config.json
```

scoria writes them with `JSON.stringify`, which always expands arrays, while Prettier collapses
short ones. Formatting them means the two rewrite the file in turn on every run.

Nothing is written when `CI=true`; the run only reports that the detection is not frozen.

## In CI

```yaml
- name: scoria
  run: npx -y scoria
```

`mode: report` is the default, so **this never fails a build**. It prints scores and findings.
Ratchet gating on regression is not implemented yet (spec §17).

On GitHub Actions the report is also written to the run's **job summary**, where it renders as a
table with a bar per dimension and collapsible lists of findings. A CI log is a wall of text nobody
scrolls; the summary lands on the page a reviewer is already looking at. It needs no token and no
`permissions:` block — the runner provides a file, and scoria appends to it.

```markdown
## scoria — 63 / 100

`vue · ts` · profile: app · 458 files · 59120 sloc · 1456 test sloc

| Dimension   | Score |              | Confidence |
| ----------- | ----: | ------------ | ---------- |
| integrity   |    67 | `███████░░░` | high       |
| readability |    30 | `███░░░░░░░` | high       |
| type-safety |    90 | `█████████░` | high       |
```

Pass `--no-summary` to turn it off.

## Output

```text
/Users/isamu/ss/ownplate  [vue · ts]  profile: app
458 files · 59120 sloc · 1456 test sloc   config: config-file

  Dimension            Score   Confidence
  ──────────────────────────────────────────────────────────────
  integrity               79   high
  readability             30   high
  type-safety             90   high
  ──────────────────────────────────────────────────────────────
  Overall                 66   not comparable across repos

8 findings at severity error
  src/components/CustomerInfo.vue:108  eslint-disable-no-reason  suppresses an ESLint rule, with no reason given

63 warnings
  god-file                 21
  untyped-source           42
```

**Scores are not comparable across repositories.** Normalisation, the set of active probes, and the
strictness of a project's own gates all differ. Only the time series within one repository means
anything, and the report JSON carries `"comparable": false` to say so (spec §3.3). No badge output
is provided.

```bash
scoria doctor                  # gaps in the gates this project sets for itself
scoria doctor --fix            # apply the unambiguous repairs
scoria --json                  # the report as JSON
scoria --explain readability   # the breakdown, and what a fix is worth
scoria --no-write              # do not create a config file
scoria --lang ja               # Japanese terminal output
```

Terminal output is translatable; the JSON report is not. `Finding.message` stays English so that
downstream tooling reads one stable vocabulary, and the rule id joins the two.

## Reading the report

**Read the Confidence column before the Score column.** `medium` or `low` means the dimension was
measured through suppressions, so the number describes the measurement as much as the code. A
readability of 88 with 60 `eslint-disable` comments in scope is not a readable codebase; it is an
unmeasured one.

**A single run tells you little.** The score exists to watch one repository's own trend, and the
first run is only the baseline. Comparing it to another project's number is meaningless.

**Then ask what is costing you points**, which is what `explain` is for:

```text
$ scoria --explain readability

  metric                                       value            scale     pts
  ──────────────────────────────────────────────────────────────
  file-shape.sloc_p95                         353.00        150 → 800    34.4
  file-shape.max_file_sloc                   2673.00       300 → 2000     0.0
  file-shape.god_file_count                     7.00           0 → 20    13.0
  ──────────────────────────────────────────────────────────────
                                                                         47.4

  largest contributors to file-shape.sloc_p95
        2673  src/data/scriptTemplates.ts
        1403  src/data/markdownStyles.ts
```

`max_file_sloc` scored **0.0 of a possible 30** — the value is past the far end of its scale, so it
is the single largest lever in this dimension, and the contributor list names the file. Because the
scale is linear and clamped, the points column is directly the answer to "what is fixing this
worth?".

**`findings at severity error` are the actionable ones.** They are all suppressions with no stated
reason: either write the reason — `-- why` after an ESLint rule name, prose after
`@ts-expect-error` — or remove the suppression. Warnings are counted by rule rather than listed,
because a hundred `untyped-source` lines is one decision, not a hundred.

**`config: detected`** means the run was not frozen: scoria detected the stack rather than reading a
committed config. Commit `scoria.config.json` so later runs measure the same way.

### A caveat worth knowing

`file-shape` counts lines without asking what is in them, so a 2,673-line table of templates is
penalised exactly like a 2,673-line module of logic. The two are not equally hard to read. Until
this is calibrated, treat a large `data/` file as a known false positive rather than a finding.

## Diagnosing the setup

`scoria doctor` reports the gaps in the gates a project sets for itself — no ESLint config, no
`test` script, `strict` off, CI that never runs `typecheck`, a step that swallows its failure.
These are not style opinions: each one makes some other score read better than the repository
deserves, which is why they also feed the `integrity` dimension.

```text
4 gaps in the gates this project sets for itself

  ! No `typecheck` script
      CI cannot run what package.json does not define, so nothing enforces typecheck.
      fixable with --fix

  × 1 step swallows their failure
      `continue-on-error: true` or `|| true` makes a job green whatever it found.
```

`--fix` applies only repairs with exactly one correct outcome — appending `node_modules/` to
`.gitignore`, adding `"typecheck": "tsc --noEmit"` when TypeScript is present. Choosing a lint
configuration for someone is a judgement, so it is reported and left alone. Installing the
toolchain itself is what [ever-better](https://github.com/isamu/ever-better) is for.

## What it measures today

| probe              | dimension                | what it looks at                                                                                  |
| ------------------ | ------------------------ | ------------------------------------------------------------------------------------------------- |
| `oxlint`           | correctness, readability | 133 rules from **scoria's own ruleset**, not the project's. Needs nothing installed in the target |
| `tsc`              | type-safety              | Type errors from the **project's own** TypeScript — the one tool that must be theirs              |
| `knip`             | architecture             | Files, exports and dependencies nothing reaches                                                   |
| `jscpd`            | readability              | Copy-paste duplication                                                                            |
| `suppression-scan` | integrity                | `as any`, `@ts-ignore`, `eslint-disable`, `it.skip`. Only the ones without a reason become errors |
| `config-integrity` | integrity                | ESLint config present, `strict` on, required scripts defined                                      |
| `ci-integrity`     | integrity                | CI runs lint / typecheck / build / test, and does not swallow failures                            |
| `file-shape`       | readability              | p95 and maximum file length, and the count over 500 lines                                         |
| `source-mix`       | type-safety              | `.js` / `.jsx` remaining in a TypeScript project                                                  |

### scoria measures against its own standard, not yours

A project's own linter config may be lax, and measuring only against it means **a repository that
turns off every rule scores perfectly**. That is the same failure the `integrity` dimension exists
to catch, so the other dimensions use scoria's ruleset (oxlint, 133 rules) and say so.

"CI's lint is green but scoria is low" is therefore not a defect. It is the finding.

`tsc` is the single exception: a type check is only meaningful against the project's own tsconfig
and installed type definitions, so scoria runs theirs.

### Some checks need the project installed

`tsc` and `knip` resolve the import graph, so they need `node_modules`. Where it is missing they
report **skipped**, and the dimension says how much of it could be measured — never a perfect score
for something nobody looked at.

## Tracking change over time

```bash
scoria baseline      # record this run
git add .scoria/baseline.json
```

Later runs report the difference:

```text
What moved
    -30.0  integrity      suppression-scan.source_per_kloc   0 → 975
    -20.0  integrity      suppression-scan.unreasoned_ratio  0 → 1
```

Each mover names the metric that moved and what it cost. Upgrading one of the tools adds rules and
the score falls, which is not a regression — scoria records tool versions in the baseline and says
so rather than reporting decay.

Stacks: `ts` (`.ts` `.tsx` `.mts` `.cts` `.js` `.jsx` `.mjs` `.cjs`), `vue` (only the SFC
`<script>` block is scanned), `react`.

### Two decisions worth knowing about

**An ESLint rule name is not a reason.** Only text after `--` counts, following ESLint's own
convention. Accepting the rule name would mean `eslint-disable-next-line no-console` justifies
itself, and the measurement would mean nothing.

**Suppressions lower confidence, not just score.** ESLint reporting zero warnings while 60
`eslint-disable` comments are present does not mean the code is readable; it means the dimension
was not measured. That is reported as `confidence: low` (spec §15.4).

## Not here yet

Ratchet gating (failing CI on regression), `dependency-cruiser`, test coverage and mutation
testing, SARIF output, and calibration. **Every threshold is still provisional** and every dimension
is `experimental`.

## Development

```bash
yarn format:check && yarn lint && yarn typecheck && yarn build && yarn test
```

Lint is set to the bar used by [ever-better](https://github.com/isamu/ever-better): type-aware
`typescript-eslint`, SonarJS, and `noInlineConfig`, which means `eslint-disable` cannot be written
here at all. scoria measures suppression debt; having none of its own is the point.

## License

MIT
