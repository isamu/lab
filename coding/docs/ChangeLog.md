# scoria ChangeLog

Newest first.

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
