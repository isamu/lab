# scoria ChangeLog

Newest first.

## 0.3.0 — 2026-09-13

Two more dimensions, a gate, and three separate ways the report was saying something untrue.

### Added

- **`mode: ratchet`** fails the run when a dimension falls more than a point below its baseline,
  when an unexplained suppression is added, or when an `error` finding appears in a file that did
  not have one. The default stays `report`, which gates nothing. What it refuses to gate matters as
  much: a dimension whose confidence is `low`, one whose tool changed version, and density metrics
  once the repository changed size by a fifth — each reported under _Regressed, but not gated_,
  because a regression silently excluded is indistinguishable from no regression.
- **`targets`** names the directories to measure, as globs, when a repository holds more than one
  project. The rules are [`repo.json` §9](https://github.com/repos-json/repos-json)'s rather than
  scoria's, so a repository that declares its units once is read the same way by every tool that
  reads them — including the rule that a project's extent is its directory _minus_ the directories
  of any nested projects. Measured from the root, ownplate's `tsc` reported zero errors without
  looking at `functions/`'s 93 files and its `audit` missed 4 high and 19 moderate advisories.
- **`repo.json` is read** where a repository has one: `projects` supplies the targets, `name` is
  what the report and badge call each project, and `extensions.scoria` holds settings. `color` is
  deliberately not read — the badge's colour is the direction of travel, and taking it from the
  repository would let a repository paint its own regression green.
- **`documentation`** — whether a README exists, how much it says, and whether it still lists the
  flags the program accepts. Adding a flag and documenting it are two separate acts and only one is
  needed to ship.
- **`ui-consistency`** — how many _distinct_ colours and spacing values the components use, not how
  many occurrences. A design system converges spacing on 4, 8, 12, 16; a codebase written a
  component at a time accumulates 5, 7, 13, 17, 23. Across six UI projects, five carried at most 14
  colours and one carried 201.
- **The job summary opens with a chart.** GitHub renders a mermaid fence wherever it renders
  Markdown, so it costs no image, no artifact and no third party.
- **`--badge-json`** writes a shields.io endpoint badge, needing no server.
- **Coverage reads lcov** as well as `json-summary`. Most tools emit lcov by default and
  `json-summary` only when asked, so the probe had been looking for the file a project is least
  likely to have — it had never once produced a value in 49 repositories.

### Fixed

- **A rubric change was reported as an improvement.** A metric the baseline never had counted as
  `from: 0`, so the whole of a new metric's points read as a gain: `security` would have shown
  `+100` the first time it existed, with `audit.critical` the largest mover at `0 → 0`. Two runs
  that measured different metrics are no longer compared — nor are two that measured different
  _amounts_ of the same dimension, which reported `test_to_source_ratio` as `-69.8` while its value
  improved.
- **knip's unused files were never counted.** Its JSON emits `files` as `{ name }` objects and the
  parser read only strings, so the metric reported clean in all 49 repositories. Un-silencing it
  then over-reported — 573 files in one monorepo against the 450 scoria classifies as source — so
  knip's findings are now intersected with what scoria itself measures.
- **oxlint failing reported a clean repository.** An empty diagnostic list meant both "found
  nothing" and "crashed"; unreadable output is now `skipped`.
- **A CI gate counted as run if the word appeared anywhere in the workflow file** — a job named
  `test`, a comment, an action input. Steps are parsed now. And **no CI at all scored better than
  bad CI**: one gap against a denominator of six.
- **`|| true` is not always a swallowed failure.** Capturing output from a command that exits
  non-zero and then judging it is the opposite, and the scan was reporting an `error` against a
  step stricter than most.
- **A partial coverage report became a measurement of zero.** Absent sections are emitted as
  nothing and the rubric skips them.
- **Reported paths kept their absolute form on Windows.**

### Changed

- `architecture` weighs **shares** of the repository's files rather than counts. Measured across 49
  repositories, `knip.unused_exports` correlated +0.63 with repository size and the share +0.30;
  `unused_files` +0.30 and the share −0.07. The dimension's correlation with size fell from −0.48
  to −0.19 and its corpus median from 86 to 75 — a count with a fixed anchor was generous to small
  repositories. `god_file_count` and `circular.cycle_count` stay counts: normalising them leaves
  the correlation exactly where it was, so that correlation is the corpus, not the metric.

### Note for adopters

`documentation` and `ui-consistency` are new and `architecture`'s metrics changed, so the first run
after this reports those as `—` rather than inventing a change. Run `scoria baseline` once and
commit it. A repository with no `.vue`, `.tsx` or `.jsx` files reports `ui-consistency` as `—`
permanently, which is correct and says so.

### Still provisional

Every scale is still `experimental`. [docs/calibration.md](calibration.md) is the first measurement
of what they do — 49 repositories, what each scale asserts, and the two findings that moving an
anchor would not have fixed. It made them known, not right.

[docs/the-original-list.md](the-original-list.md) records every tool the project was asked for and
whether it is measured or closed with a reason. Mutation testing, Playwright, axe, Lighthouse and an
AI reviewer are closed.

### Merged pull requests

- #65 — `mode: ratchet`
- #66 — knip's unused files were never counted
- #69, #75 — `targets`, then conformed to `repo.json` §9
- #78 — read `repo.json`
- #80 — the job summary opens with a chart
- #81 — `|| true` is not always a swallowed failure
- #82 — calibration against 49 repositories
- #83 — `architecture` weighs shares, not counts
- #84 — coverage reads lcov, and CI produces one
- #85, #93 — a dimension whose measurable weight changed is not comparable
- #87 — the `documentation` dimension
- #90 — the `ui-consistency` dimension, and mutation ruled out
- #99 — six ways the report could be wrong, from a codex review
- #100 — close the original list
- #102 — answer what scoria says about this repository

## 0.2.0 — 2026-09-12

Three more of the things the tool was asked to measure, and a badge that refuses to be comparable.

### Added

- **`security`** — the `audit` probe asks the project's own package manager for known advisories.
  Which one is decided by the lockfile: `npm audit` cannot read a `yarn.lock` and reports nothing
  rather than failing, which would have read as a clean tree. The scales are steep on purpose —
  one critical takes that metric to zero.
- **`test-coverage`** — `test-presence` always, `coverage` where the project already produced a
  report. **scoria does not run your tests.** A suite can take minutes, touch a database, need
  credentials, or leave state behind, and a tool that triggers that as a side effect of being asked
  for a number is not one anyone runs twice. With no report, coverage is `skipped` and the
  dimension says how much of it could be measured — never a perfect score for something nobody
  looked at.
- **`circular`** joins knip under `architecture`. knip finds code nothing reaches; a cycle is code
  tangled together, which is invisible to it. madge rather than dependency-cruiser, which resolved
  nothing on real repositories even given a config and a tsconfig. The cost is dependency-cruiser's
  layer rules, which madge cannot express.
- **`--badge-json <path>`** writes the JSON a shields.io endpoint badge reads. Publish it anywhere
  public — an orphan branch of the same repository is enough — and the badge needs no server, no
  gist, and no token beyond `GITHUB_TOKEN`. The message carries `97 · this repo only` because a
  badge travels without the README that would have explained it, and **the colour is the direction
  of travel, never the level**: green when no dimension fell since the baseline, orange when one
  did, blue when there is no baseline. Colouring by the number would assert that 90 means the same
  thing in every repository, which is the one claim this tool exists to refuse.

### Fixed

- **A rubric change was reported as an improvement.** A metric the baseline never had was treated
  as `from: 0, points: 0`, so the whole of a new metric's points read as a gain — this release's own
  `security` dimension would have shown `+100`, with `audit.critical` as the largest single mover
  at `0 → 0`, and `architecture` as a regression because a new metric had renormalised the other
  weights down. A dimension is now comparable only when both runs scored it and both measured the
  same set of metrics; otherwise no delta is claimed, no movers are emitted, and the run says which
  dimensions and why.
- **A dimension nothing could be measured in read as having scored zero**, so a probe becoming
  runnable showed as `+100`.

### Note for adopters

Upgrading to this release changes what four dimensions are made of, so the first run after it will
report those as `—` rather than inventing a change. Run `scoria baseline` once and commit it.

### Still provisional

Every scale remains uncalibrated and every rubric is `experimental`. A badge makes that more
visible, not less true: the number is this repository's own, and holding it against another
project's means nothing.

### Merged pull requests

- #43 — security, test coverage, and circular dependencies
- #45 — no change reported when the rubric changed underneath
- #51 — a badge that refuses to be comparable
- #53 — the badges branch cannot be switched to before it exists
- #56 — both baselines re-recorded

## 0.1.1 — 2026-09-12

Findings reach GitHub's Security tab and the lines of a pull request.

### Added

- **`--sarif <path>`** writes SARIF 2.1.0. Uploading it with `github/codeql-action/upload-sarif`
  puts every finding on the repository's Security tab and, more usefully, **inline on the changed
  lines of a pull request** — where the person who wrote the line is already looking. A score in a
  log is something you have to go and read; a comment on the line is not.
  Rule ids are namespaced `scoria/<probe>/<rule>` so they cannot collide with an upload from the
  same tool run directly, and `info` maps to SARIF's `note`, the only level it has for that.

### Fixed

- **`ci-integrity` reported a directory as a location.** `.github/workflows` is not a file GitHub
  can open, and a SARIF location has to be. Workflows also live at the repository root, which is
  above the measured directory in a monorepo, and a location outside the uploaded tree matches
  nothing — those findings now report against `package.json` with the workflow named in the message.
- **jscpd counted scoria's own output as duplication.** It scanned every format including JSON, so
  `.scoria/baseline.json` registered as duplicated code: **recording a baseline changed the next
  measurement**, which leaves no time series at all. Duplication is now measured on source formats
  with scoria's artifacts excluded.
- **A delta that rounds to zero rendered as `-0 ⚠`**, reporting a regression that did not happen.
- **Both summary tables were titled `scoria`** with nothing to say which workspace each described.
- **The version in SARIF was a constant in the source.** It is read from the manifest now; a stale
  one would attribute findings to a release that never produced them.

### Note for adopters

If the project formats JSON with Prettier, add `.scoria/` and `scoria.config.json` to
`.prettierignore`. scoria writes them with `JSON.stringify`, which always expands arrays, while
Prettier collapses short ones — left formatted, the two rewrite the file in turn on every run.

### Merged pull requests

- #33 — acting on what scoria says about scoria: overall 84 → 98, warnings 37 → 2
- #36 — measuring the whole repository on every change, both workspaces
- #39 — SARIF output

## 0.1.0 — 2026-09-11

The external tools, and the baseline that makes improvement and regression visible — the thing the
tool was for.

### The core decision reversed

The spec said scoria measures a project against **its own** gates, and ran the project's ESLint to
do it. That was wrong: a repository that turns off every rule then scores perfectly. It is the same
"buying the scorer" failure the `integrity` dimension exists to catch, and it was let through in
every dimension except integrity — writing one `eslint-disable` lowered the score, while disabling
that rule in config did nothing.

scoria now brings its own standard. **"CI's lint is green but scoria is low" is not a defect; it is
the finding.** The report always says which standard it measured against.

### Added

- **`oxlint`** — 133 rules from scoria's own ruleset, feeding `correctness` and `readability`.
  Chosen over ESLint because the ruleset must not depend on the target's node_modules: it runs
  standalone, parses `.ts` / `.tsx` / `.js` / `.jsx` / `.vue` itself, and covers 313 files in 1.8s.
- **`tsc`** — type errors from the **project's own** TypeScript. The single exception to the rule
  above, because a type check is only meaningful against that project's tsconfig and installed types.
- **`knip`** — unused files, exports and dependencies, as a new `architecture` dimension.
- **`jscpd`** — copy-paste duplication.
- **`scoria baseline`** — records a run to `.scoria/baseline.json`; later runs report what moved,
  naming the metric and what it cost. Tool versions are recorded with it, so a score that falls
  because a linter gained rules is reported as needing a fresh baseline rather than as decay.
- The GitHub job summary gained a delta column and the movers list.

Five dimensions now have something behind them. Before this, `readability` was file sizes and
`type-safety` was a `.js` count; the names promised far more than they delivered.

### Fixed

Four bugs, each of which made a repository look better than it is.

- **Unmeasured dimensions scored full marks.** The contract distinguished ok / absent / skipped but
  the scoring did not: a missing value became 0, and for a lower-is-better metric 0 is perfect. A
  directory with no source, no eslint and no CI scored 90/100 with two dimensions at 100 and marked
  high confidence. `absent` now scores 0, `skipped` is excluded with the weights renormalised, and a
  dimension with nothing measurable reports no score rather than a number standing in for one.
- **`ctx.exec` discarded stdout on a non-zero exit** — which is exactly when a linter has something
  to report. Every external probe returned nothing until this was found.
- **`knip` without node_modules** resolves nothing and reports nothing, which read as a clean
  repository. It now requires the project to be installed and reports skipped otherwise.
- **Windows would have been broken.** Every tool scoria drives ships its bin as a
  `#!/usr/bin/env node` script, and Windows does not honour a shebang. No CI job covered that path —
  the Windows runner exercises scoria's own gates, not scoria measuring a repository. Tools now run
  through the Node already executing.

### Changed

- The install is about 25 MB, against a spec budget of 5 MB written when scoria used the project's
  ESLint. Shipping our own linter costs 12 MB for oxlint's platform binary alone. The budget is now
  30 MB, stated with the measurements, rather than held by declining to measure.

### Merged pull requests

- #27 — the spec revision: §3.2 reversed, §3.2.1 and §18.1 added, §12.1 rewritten from measurements
- #28 — absent and skipped scored rather than treated as zero
- #30 — oxlint, jscpd, tsc, knip, baseline and delta, and the Windows fix

### Still provisional

Every scale. Correctness lands at 48-83 and readability at 31-89 across three real repositories,
and nothing is calibrated. Ratchet gating, `dependency-cruiser`, coverage and mutation testing, and
SARIF output are not here.

## 0.0.3 — 2026-09-11

Readable output: `explain` names the file to fix, and CI renders a table instead of a wall of text.

### Added

- **The GitHub Actions job summary.** The report is written to `GITHUB_STEP_SUMMARY` when the
  variable is set, rendering as a table with a bar per dimension and collapsible lists of findings
  and warnings. A CI log is a wall of text nobody scrolls; the summary appears on the run page and
  in the pull request's checks tab, which is where a reviewer already is.
  It needs no token and no `permissions:` block — the runner provides the file — so unlike a sticky
  pull request comment it also works on pull requests from forks. `--no-summary` opts out.
- **`--explain` names the files behind a metric.** Probes already recorded which files drove a
  value, but the report dropped it, so a dimension could be reported as costing 30 points without
  saying where. Spec §22.2 had `topContributors` in the report format all along; now it is wired.

### Changed

- **`README.ja.md` is a rewrite rather than a translation.** It had leaned on terms that assume the
  spec — dimension, probe, integrity, suppression, percentile — without explaining any of them. It
  is now organised around what someone does (run it, read the screen, decide what to fix first),
  with tables mapping every identifier that appears in the output to plain language.
- **Both READMEs gained a section on reading a report**, stating the two things most likely to be
  misread: a score is only comparable to the same repository's own history, and a high score with
  low confidence means the dimension was not measured rather than that the code is good.

### Known limitation, now documented

`file-shape` counts lines without asking what is in them, so a 2,673-line table of templates is
penalised exactly like a 2,673-line module of logic. Observed on a real repository, where a `data/`
directory drove the readability score. Both READMEs say so; the probe is unchanged pending
calibration.

### Merged pull requests

- #15 — contributor files in `explain`, plain-language Japanese README, reading guide in both
- #17 — GitHub Actions job summary

## 0.0.2 — 2026-09-11

English output, Vue and TSX support, and a diagnostic mode.

### Added

- **Vue single-file component support.** Only the `<script>` block is scanned as JavaScript.
  Scanning a `<template>` as JS makes HTML attribute quotes and apostrophes in body text open
  string literals, hiding the code that follows. On a real Vue application this took the measured
  surface from 215 files / 26,169 sloc to 458 files / 59,120 sloc — over half the repository had
  been invisible.
- **`.tsx` / `.jsx` / `.mts` / `.cts` recognised as source.**
- **`type-safety` dimension — `source-mix` probe.** Reports `.js` / `.jsx` remaining in a
  TypeScript project. An untyped file skips the type checker at file granularity and leaves no
  trace in the code, which makes it worse than `@ts-nocheck`, not better. Projects without
  TypeScript are skipped rather than warned.
- **Stack detection and freezing.** vue / nuxt → vue, react / next → react, `bin` → cli, published
  `exports` → library. `scoria init` writes `scoria.config.json`; the first run without a config
  writes it automatically. Detection is frozen there, because re-detecting every run means one
  added dependency moves the score. Drift is reported, never silently followed. Nothing is written
  under `CI=true`.
- **`scoria doctor`** — reports the gaps in the gates a project sets for itself: no ESLint config,
  flat and legacy configs together, `strict` off, missing `lint` / `build` / `test` / `typecheck`
  scripts, `node_modules` unignored, no CI workflow, CI that never runs those gates, and steps that
  swallow their failure with `continue-on-error: true` or `|| true`.
  These feed the `integrity` dimension, because each one makes some other score read better than
  the repository deserves.
- **`scoria doctor --fix`** applies only repairs with exactly one correct outcome: appending
  `node_modules/` to `.gitignore`, and adding `"typecheck": "tsc --noEmit"` where TypeScript is a
  dependency. Choosing a lint configuration for someone is a judgement, so it is reported and left
  alone. Installing a toolchain is what ever-better is for.
- **English output, with `--lang ja` for Japanese.** The JSON report is not translated:
  `Finding.message` stays English so downstream tooling reads one stable vocabulary, and the rule
  id joins the two. `README.ja.md` carries the Japanese documentation.

### Fixed

- **Column alignment for non-ASCII output.** `padEnd` counts code points, so a table column holding
  `次元` — two code points, four columns — collapsed. Padding is now display-width aware.
- **False positives from comments and string literals.** The probe's own explanatory comments,
  regex literals and the string `"eslint-disable"` were counted as suppressions. Code and comments
  are now separated by a scanner, and a directive only counts at the start of a comment, where it
  actually takes effect.
- **ESLint rule names counted as reasons.** `eslint-disable-next-line no-console` was treated as
  justified because `no-console` followed the directive. Only text after `--` counts now, per
  ESLint's own convention; without this, writing the rule name would justify any suppression.
- **Workflow discovery in a monorepo subdirectory.** A package one level below the repository root
  was told it had no CI when the workflow was in the parent. The search now walks up to the git root.
- **`bin` path.** `./bin/scoria.js` made npm emit a warning that reads as though the entry were
  dropped. It was not, but the prefix is gone.

### Changed

- The `integrity` rubric now weights suppression metrics at 0.6 and the new config/CI gap ratios at
  0.4, so integrity scores move for every repository.
- `@scoria/stack-ts` was folded back into `scoria`. A single package means `npm pack` produces one
  artifact that runs anywhere, which is what makes testing before publishing possible at all.

### Merged pull requests

- #9 — Vue/TSX support, untyped-source warning, `scoria init`, single-package consolidation
- #12 — English output and documentation, `--lang ja`, display-width padding
- #13 — `scoria doctor`, the config-integrity and ci-integrity probes, bin path fix

## 0.0.1 — 2026-09-11

First release. A walking skeleton: three probes, no external tool integration, every dimension still `experimental`.

### Added

- **`integrity` dimension — suppression debt.** `as any`, `@ts-ignore`, `@ts-expect-error`, `eslint-disable`,
  `it.skip` / `.only` / `.todo` are counted. Only suppressions without a reason become `error` findings.
  ESLint rule names are not accepted as reasons — only text after `--`, per ESLint's own convention.
  Counting the rule name as a justification would mean writing `no-console` justifies the suppression,
  which makes the measurement meaningless.
- **Counts split by file kind.** Measured on a real repository, 69 of 94 `as any` occurrences were in test
  files, where mocking makes them legitimate. A single total buried the 25 in source.
- **Confidence propagation.** Suppression density lowers the reported confidence of other dimensions.
  ESLint reporting zero warnings while 60 `eslint-disable` comments are present does not mean the code is
  readable; it means the dimension was not measured.
- **`readability` dimension — `file-shape` probe.** Percentile and maximum of file length, and the count of
  files over 500 lines. Percentiles rather than the mean: on two maintained repositories the median was 63
  lines in both, so the median discriminates nothing; the signal is in p95 and the maximum.
- **`type-safety` dimension — `source-mix` probe.** Reports `.js` / `.jsx` remaining in a TypeScript project.
  An untyped file skips the type checker at file granularity and leaves no trace in the code.
  Repositories without TypeScript are skipped rather than warned.
- **Vue SFC support.** Only the `<script>` block is scanned as JavaScript. Reading a `<template>` as JS makes
  HTML attribute quotes and apostrophes in body text open string literals, hiding the code after them.
- **`.tsx` / `.jsx` / `.mts` / `.cts` recognised as source.**
- **Stack detection and freezing.** `vue` / `nuxt` → vue, `react` / `next` → react, `bin` → cli,
  published `exports` → library. `scoria init` writes `scoria.config.json`; the first run without a config
  writes it automatically. Detection is frozen there — re-detecting on every run means adding one dependency
  moves the score, and the time series stops meaning anything. Drift is reported, never silently followed.
  Nothing is written when `CI=true`.
- **Linear, clamped scoring.** Explainability is chosen over accuracy so `scoria --explain <dimension>` can
  say what a given fix is worth. A test pins the invariant that per-metric deltas sum to the dimension delta;
  introducing a non-linear curve breaks it.
- **CLI.** `scoria [dir]`, `scoria init`, `--json`, `--explain <dimension>`, `--no-write`.

### Notes

Scores are not comparable across repositories. Normalisation, active probes, and the strictness of a
project's own gates all differ; only the time series within one repository means anything. The report JSON
carries `"comparable": false`, and no badge output is provided.

`mode: report` is the only mode, and it never fails a build.

### Merged pull requests

- #3 — design spec, 31 sections
- #6 — walking skeleton: probe contract through to CLI output
- #7 — formatting fix so `main` passes `format:check`
- #9 — Vue/TSX support, untyped-source warning, `scoria init`, single-package consolidation
- #10 — first published version set to `0.0.1`

### Not in this release

External probes (eslint, knip, dependency-cruiser, jscpd), baseline and ratchet gating, tiers above 0,
a GitHub Action, SARIF output, calibration. All thresholds are provisional.
