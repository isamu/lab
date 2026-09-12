# Calibration

Every scale in `rubrics/*.yaml` was a guess, and every rubric still says `status: experimental`.
This is the first measurement of what those guesses actually do.

Nothing here changes a scale. It is the evidence a change would have to argue against, and it
already says two things that no amount of re-anchoring would fix.

## The corpus

49 TypeScript and JavaScript repositories, measured on 2026-09-13 with scoria at `fe3b3b3`: the 48
in one developer's `maintained-repos.json` plus ownplate. Libraries, CLIs, web apps, Vue apps,
Electron apps, servers, forks being maintained downstream. 1 to 292,490 source lines. 47 of the 49
had their dependencies installed, so the tier-1 probes ran almost everywhere.

```bash
# one report per repository, read-only
scoria <repo> --json --no-write --no-summary > <name>.json
```

It is one person's corpus. That bounds what it can say: it is evidence about how these scales
behave on real repositories of varied size and kind, not a sample of all TypeScript in the world.

## What the corpus is not for

The first instinct was to move each `bad` anchor to the corpus's 90th percentile, so that scoring
zero would mean "as bad as the worst tenth". Simulating it made things worse:

| dimension       | median now | median with p90 anchors |
| --------------- | ---------: | ----------------------: |
| `correctness`   |         57 |                      94 |
| `test-coverage` |         25 |                     100 |
| `security`      |         59 |                      85 |

Anchoring to the corpus is grading on a curve, and §3.2 says the opposite: scoria brings its own
strict ruleset rather than measuring a project against whatever it already tolerates. A corpus
carrying 14 high-severity advisories at the median would have defined 42 of them as the floor, and
a repository with 14 would have scored 74 for it.

So the corpus is used to find scales that **cannot discriminate** and metrics that **measure the
wrong thing** — not to decide where a standard should sit.

## Finding 1: two dimensions measure size

Spearman's ρ between a dimension's score and the repository's source lines:

| dimension       | ρ with size |
| --------------- | ----------: |
| `readability`   |   **−0.53** |
| `architecture`  |   **−0.48** |
| `integrity`     |       −0.31 |
| `test-coverage` |       +0.20 |
| `type-safety`   |       −0.14 |
| `security`      |       −0.11 |
| `correctness`   |       +0.10 |

Four of the seven are properly size-independent. Two are not, and the reason is visible one level
down: their metrics are **raw counts on a fixed scale**.

| metric                      | ρ with size | scale              |
| --------------------------- | ----------: | ------------------ |
| `file-shape.max_file_sloc`  |   **+0.86** | good 300, bad 2000 |
| `file-shape.god_file_count` |   **+0.68** | good 0, bad 20     |
| `file-shape.sloc_p95`       |   **+0.66** | good 150, bad 800  |
| `knip.unused_exports`       |   **+0.63** | good 0, bad 60     |

A count of god files with `bad: 20` means any repository past twenty scores zero, whether it has
200 files or 2,500. The largest repository in the corpus has 81; the five smallest have none,
because they have barely twenty files in total.

| repository             |    sloc | god files | unused exports | readability | architecture |
| ---------------------- | ------: | --------: | -------------: | ----------: | -----------: |
| mulmoclaude            | 292,490 |        81 |            120 |          29 |           45 |
| mulmoterminal          |  99,953 |        26 |              4 |          42 |           92 |
| ownplate               |  59,120 |        21 |             12 |          44 |           65 |
| …                      |         |           |                |             |              |
| graphai_agent_template |      26 |         0 |              0 |         100 |           98 |
| ts-template            |       1 |         0 |              0 |          85 |           99 |

The overall score hides it: ρ between size and `overall` is −0.03, because the size-dependent
dimensions and the size-independent ones average out. A reader looking only at the headline would
never see it.

Note which correlations are **not** artefacts. `suppression-scan.source_per_kloc` (+0.52) and
`unreasoned_ratio` (+0.56) are already normalised by size, so what they show is a real property of
the corpus: larger repositories here carry proportionally more suppressions, and explain fewer of
them. That is a finding about the code, not about the metric.

## Finding 2: `coverage` has never run

| metric                  | repositories producing it |
| ----------------------- | ------------------------: |
| `coverage.line_pct`     |                   0 of 49 |
| `coverage.branch_pct`   |                   0 of 49 |
| `coverage.function_pct` |                   0 of 49 |

The probe reads `coverage/coverage-summary.json` and reports `skipped` when there is none. Across
49 repositories there was never one. The design is deliberate — scoria does not run your tests —
but the consequence is that three of its metrics have never produced a value, and `test-coverage`
has always been carried by `test-presence` alone. The dimension's "only 30% of this could be
measured" note is doing all the work.

## What each scale currently asserts

`full marks` is how many repositories score 100 on that metric; `zero` is how many score 0. A metric
with most of the corpus at either end cannot tell two repositories apart, whether or not the
standard behind it is defensible.

<!-- generated: see "The corpus" above for how to reproduce -->

| metric                               |   n | min |   p10 | median |      p90 |      max | scale             | full marks | zero | ρ with size |
| ------------------------------------ | --: | --: | ----: | -----: | -------: | -------: | ----------------- | ---------: | ---: | ----------: |
| `audit.critical`                     |  48 |   0 |     0 |      0 |        0 |        5 | good 0 bad 1      |         46 |    2 |       +0.11 |
| `audit.high`                         |  48 |   0 |   1.4 |   14.5 |       42 |      134 | good 0 bad 5      |          5 |   39 |       +0.09 |
| `audit.moderate`                     |  48 |   0 |     0 |      6 |     30.9 |      136 | good 0 bad 20     |         12 |   10 |       +0.23 |
| `ci-integrity.gap_ratio`             |  49 |   0 | 0.167 |  0.167 |    0.367 |      0.5 | good 0 bad 0.6    |          3 |    0 |       -0.04 |
| `circular.cycle_count`               |  45 |   0 |     0 |      0 |        2 |       85 | good 0 bad 8      |         34 |    3 |       +0.33 |
| `config-integrity.gap_ratio`         |  49 |   0 |     0 |   0.25 |    0.375 |      0.5 | good 0 bad 0.6    |         10 |    0 |       -0.30 |
| `coverage.branch_pct`                |   0 |   — |     — |      — |        — |        — | good 85 bad 30    |          — |    — |           — |
| `coverage.function_pct`              |   0 |   — |     — |      — |        — |        — | good 90 bad 40    |          — |    — |           — |
| `coverage.line_pct`                  |   0 |   — |     — |      — |        — |        — | good 90 bad 40    |          — |    — |           — |
| `file-shape.god_file_count`          |  48 |   0 |     0 |      0 |      5.3 |       81 | good 0 bad 20     |         26 |    3 |  **+0.68 ** |
| `file-shape.max_file_sloc`           |  48 |   1 |  58.1 |    420 | 1.65e+03 | 2.67e+03 | good 300 bad 2000 |         20 |    2 |  **+0.86 ** |
| `file-shape.sloc_p95`                |  48 |   1 |  51.8 |    255 |      505 | 1.71e+03 | good 150 bad 800  |         14 |    2 |  **+0.66 ** |
| `jscpd.duplicated_lines_pct`         |  48 |   0 |     0 |      3 |     23.1 |       59 | good 0 bad 10     |         11 |   14 |       +0.36 |
| `knip.unused_dependencies`           |  46 |   0 |     0 |      0 |        4 |        6 | good 0 bad 10     |         25 |    0 |       +0.26 |
| `knip.unused_exports`                |  46 |   0 |     0 |      1 |     15.5 |      120 | good 0 bad 60     |         19 |    2 |  **+0.63 ** |
| `knip.unused_files`                  |  46 |   0 |     0 |    4.5 |     26.5 |      133 | good 0 bad 20     |         13 |    9 |       +0.30 |
| `oxlint.errors_per_kloc`             |  48 |   0 |     0 |  0.627 |     24.7 |    1e+03 | good 0 bad 3      |         13 |   14 |       -0.03 |
| `oxlint.violations_per_kloc`         |  48 |   0 |     0 |   6.11 |     68.8 |    1e+03 | good 0 bad 12     |          6 |   14 |       -0.03 |
| `source-mix.untyped_file_ratio`      |  42 |   0 |     0 | 0.0054 |    0.414 |    0.909 | good 0 bad 0.5    |         21 |    4 |       +0.10 |
| `source-mix.untyped_sloc_ratio`      |  42 |   0 |     0 | 0.0003 |    0.373 |     0.94 | good 0 bad 0.5    |         21 |    2 |       +0.10 |
| `suppression-scan.source_per_kloc`   |  48 |   0 |     0 |  0.189 |     4.64 |     9.24 | good 0 bad 5      |         22 |    4 |  **+0.52 ** |
| `suppression-scan.test_count`        |  48 |   0 |     0 |      0 |     21.7 |      644 | good 0 bad 200    |         34 |    2 |       +0.36 |
| `suppression-scan.unreasoned_ratio`  |  48 |   0 |     0 |  0.303 |        1 |        1 | good 0 bad 1      |         22 |   14 |  **+0.56 ** |
| `test-presence.test_to_source_ratio` |  48 |   0 |     0 |  0.163 |     1.06 |     5.21 | good 0.5 bad 0.05 |         15 |   18 |       +0.17 |
| `tsc.type_errors_per_kloc`           |  36 |   0 |     0 |      0 |     0.41 |     9.62 | good 0 bad 2      |         31 |    2 |       +0.14 |

## Reading the ends

- **`audit.high`: 39 of 48 score zero.** The scale is steep on purpose — five high-severity
  advisories is a lot — and the corpus really does carry a median of 14.5. This is a defensible
  standard that most of the corpus fails, not a broken scale, and it stays.
- **`audit.critical`: 46 of 48 score full marks.** A metric that is usually silent is doing its job
  when the thing it watches for is genuinely rare.
- **`suppression-scan.test_count`: 34 of 48 score full marks, with `bad: 200` against a corpus p90
  of 22.** Nobody defended 200; it is an order of magnitude adrift, and it is also a raw count, so
  it is size-dependent for the same reason as the metrics in Finding 1.
- **`oxlint.*` reaches 1,000 per kloc.** That is a one-line repository with a handful of
  violations. Density metrics are unstable below roughly a hundred source lines, and nine
  repositories in this corpus are that small.
- **`test-presence.test_to_source_ratio`: 18 zero, 15 full marks, little in between.** Repositories
  either have tests or do not. That bimodality looks like the world rather than the scale.

## What to do about it

Findings 1 and 2 are not scale problems and cannot be fixed by moving anchors:

1. The size-dependent metrics should be scored as **rates** — a share of files, or a count per
   thousand lines — the way `suppression-scan` and `oxlint` already are. The counts stay as
   reported metrics; what changes is which of them a rubric weighs.
2. `coverage` needs either a wider search for a report, or an honest statement in the README that
   it will almost never fire.

Both are behaviour changes and belong in their own pull requests, argued against this page.

Until then every rubric stays `experimental`, and the number on the badge stays what it has always
been: this repository's own, not comparable to anyone else's.
