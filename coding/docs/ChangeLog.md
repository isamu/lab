# scoria ChangeLog

Newest first.

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
