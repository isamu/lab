# scoria

A code quality assay harness for TypeScript and JavaScript.

It collects machine evidence about a repository, normalises it through a fixed rubric, and reports
per-dimension scores — so that improvement and regression are visible over time.

Design spec (Japanese): [scoria-spec.md](https://github.com/isamu/lab/blob/main/coding/scoria-spec.md) · 日本語の README: [README.ja.md](./README.ja.md)

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
npx --package=/tmp/scoria-0.1.1.tgz -- scoria
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

### Findings on the Security tab and inline on the diff

```yaml
- name: scoria
  run: npx -y scoria --sarif scoria.sarif

- uses: github/codeql-action/upload-sarif@v4
  with:
    sarif_file: scoria.sarif
    category: scoria
  # needs: permissions: security-events: write
```

`--sarif` writes SARIF 2.1.0. Uploading it puts each finding on the repository's **Security** tab
and, more usefully, **inline on the changed lines of a pull request** — where the person who wrote
the line is already looking. A score in a log is something you have to go and read; a comment on the
line is not.

Rule ids are namespaced as `scoria/<probe>/<rule>`, so they cannot collide with an upload from the
same tool run directly.

### A badge, without running a server

```yaml
- run: npx -y scoria --badge-json scoria.json
```

`--badge-json` writes the JSON a [shields.io endpoint badge](https://shields.io/badges/endpoint-badge)
reads. Publish that file anywhere public — committing it to an orphan branch of the same repository
is enough — and point shields at it:

```markdown
![scoria](https://img.shields.io/endpoint?url=https://raw.githubusercontent.com/OWNER/REPO/badges/scoria.json)
```

No server, no gist, no token beyond `GITHUB_TOKEN`. The badge reads `scoria · <dir>` and
`97 · this repo only`, and **its colour is the direction of travel, not the score**: green when no
dimension fell since the baseline, orange when one did, blue when there is no baseline yet. Colouring
by the number would claim that 90 means the same thing in every repository, which is the one thing
this tool refuses to say.

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
| `audit`            | security                 | Known vulnerabilities, from the project's own package manager                                     |
| `circular`         | architecture             | Import cycles — code tangled together, which unused-code analysis cannot see                      |
| `test-presence`    | test-coverage            | How much test code there is, relative to the code under test                                      |
| `coverage`         | test-coverage            | Line, branch and function coverage, read from a report the project already produced               |
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

### scoria does not run your tests

Coverage is read from a report the project already produced — `coverage/coverage-summary.json`,
which Vitest, Jest and nyc all emit. A suite can take minutes, touch a database, need credentials,
or leave state behind; a quality tool that triggers all that as a side effect of being asked for a
number is not one anyone runs twice. Without a report, coverage reports skipped and `test-presence`
still answers the blunter question.

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

Upgrading scoria itself is a different case again. A release that adds a metric changes what a
dimension is made of, so the old and the new score are not measurements of the same thing —
subtracting them would credit the release as an improvement. Those dimensions report `—` and no
movers until you record a new baseline.

### `repo.json`

If the repository has a [`repo.json`](https://github.com/repos-json/repos-json) — the open file with
which a repository says what it is — scoria reads three things from it, and you can skip configuring
them twice:

```json
{
  "name": "acme platform",
  "projects": [{ "path": "apps/web", "name": "storefront" }, "apps/api"],
  "extensions": { "scoria": { "mode": "ratchet" } }
}
```

- **`projects`** supplies the targets. A monorepo that declares its units needs no scoria config at
  all.
- **`name`** is what the report and the badge call each project — its own `repo.json` first, then the
  parent's entry for it, then its `package.json`, then the directory. Never the repository's own
  name: five packages called "acme platform" is worse than five called by their directories (§10.1).
- **`extensions.scoria`** holds settings, and states only what differs — the rest is detected. The
  invocation root's settings carry down to each project, so `mode` is set once.

`scoria.config.json` still wins over all of it: `repo.json` is what a repository says to every tool,
not an override of what you told this one (§10).

**`color` is deliberately not read.** The badge's colour is the direction of travel since the
baseline, and taking it from the repository would let a repository paint its own regression green.

### Monorepos, and repositories holding more than one project

scoria measures **one directory** and does not wander below it. Every tool it drives is rooted at
one place: `tsc` reads the tsconfig it is given, `audit` reads one lockfile, `knip` resolves one
dependency graph. Point it at a repository holding two projects and the tools see the outer one
while the file probes count both — the denominator is the whole repository and the numerator is
half of it.

ownplate is the shape: `src/` is a Vue app under the root tsconfig and lockfile, `functions/` is
Firebase Functions with its own tsconfig, package.json and **its own yarn.lock**. Measured from the
root, `tsc` reported zero errors without looking at `functions/`'s 93 files, and `audit` missed its
4 high and 19 moderate advisories entirely.

So scoria does not guess where the boundaries are. Name them:

```json
{ "targets": [".", "functions"] }
```

```json
{ "targets": ["packages/*", "agents/*"] }
```

Each target is measured as if scoria had been run inside it — its own config, its own baseline, its
own report. With no `targets`, scoria measures exactly the directory it was pointed at, which is what
every config written before this already meant.

**The rules are [`repo.json` §9](https://github.com/repos-json/repos-json)'s, not scoria's**, so a
repository that declares its units once is read the same way by every tool that reads them:

- `.` names the repository root — `[".", "functions"]` is the shape ownplate has.
- A wildcard is a segment that is exactly `*`. `**` and a partial segment like `we*` are not defined
  by that version of the format, so scoria refuses them and says so rather than guessing at a glob
  dialect.
- Directories only, never a name beginning with `.`, never `node_modules` or `vendor`.
- Matches sort by UTF-16 code unit, not by locale. Two tools listing the same packages in two orders
  is what that rule prevents.
- Declaration order is kept. One directory is one project however many entries name it, and the
  first naming it takes its place.
- **A project's extent is its directory minus the directories of any nested projects.** Without
  this, `[".", "functions"]` counts `functions/` twice. scoria excludes them from its own file
  collection and passes them on to the tools that walk a whole directory (oxlint, jscpd, madge).

Whatever is dropped is reported, with the reason. Nothing resolving at all **fails the run** —
measuring zero directories and reporting success is the one outcome nobody would notice was wrong.

With more than one target, `--sarif` and `--badge-json` get the directory name inserted
(`scoria.sarif` → `scoria.web.sarif`), so the targets do not overwrite each other.

### Failing the build on a regression

By default scoria gates nothing: it reports and exits 0. A tool that turns CI red on the day it is
installed is one nobody keeps. Once the baseline has settled, opt in:

```json
{ "mode": "ratchet" }
```

The run then exits 1 when a dimension falls more than a point below its baseline, when an
unexplained suppression is added, or when a finding at `error` severity appears in a file that did
not have one.

**What it refuses to gate matters as much as what it gates.** Three regressions are reported and
not failed, each named in the output under _Regressed, but not gated_:

|                                            | why                                                                                |
| ------------------------------------------ | ---------------------------------------------------------------------------------- |
| the dimension's confidence is `low`        | the number is about the measurement, not the code                                  |
| a tool changed version                     | a linter upgrade adds rules, not defects — gating it teaches a team not to upgrade |
| the repository changed size by 20% or more | density metrics are measuring a different denominator                              |

A regression that is silently excluded is indistinguishable from no regression, so they are printed
either way.

`mode` lives in the committed config rather than behind a flag: turning the gate on is policy, and
policy should show up in a diff.

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
