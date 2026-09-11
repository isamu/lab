# scoria ChangeLog

Newest first.

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
