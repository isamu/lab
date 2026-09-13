# The original list

scoria began as a set of tools someone wanted integrated into one package: "score a vibe-coded
TypeScript project objectively, on readability, maintainability, quality, test coverage,
documentation and UI consistency, and show the result in CI every time."

This is every item of that list, and what happened to it. Nothing is left as "not done yet": each
one is either measured or closed with a reason.

## Measured

| proposed                  | how                                                                                | dimension                    |
| ------------------------- | ---------------------------------------------------------------------------------- | ---------------------------- |
| TypeScript strict         | `tsc` against the project's own config, plus the share of untyped files            | `type-safety`                |
| ESLint + SonarJS          | **oxlint**, brought by scoria rather than read from the project (§3.2)             | `correctness`, `readability` |
| Knip                      | unused files, exports and dependencies, as shares of the repository                | `architecture`               |
| dependency-cruiser        | **madge** for cycles. dependency-cruiser resolved nothing on real repositories     | `architecture`               |
| Vitest coverage           | read from a report the project produced — `coverage-summary.json` or `lcov.info`   | `test-coverage`              |
| npm audit                 | the project's own package manager, chosen by lockfile                              | `security`                   |
| TypeDoc                   | README existence, length, and whether it still lists the flags the program accepts | `documentation`              |
| Storybook / design tokens | distinct colours and spacing values, inline styles, style blocks                   | `ui-consistency`             |
| —                         | suppression debt: `as any`, `@ts-ignore`, `eslint-disable`, `it.skip`              | `integrity`                  |
| —                         | whether the project's own gates exist and whether CI runs them                     | `integrity`                  |
| —                         | duplication (jscpd), file shape, test-to-source ratio                              | several                      |

Nine dimensions. The last three rows were not on the list: they are what measuring a generated
codebase turned out to need.

The delivery half of the request is done too — one npm package, `npx scoria` in any directory, a
GitHub job summary with a chart, SARIF on the Security tab, a badge, and `mode: ratchet` to fail a
build on a regression.

## Closed, with reasons

| proposed                             | why not                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **StrykerJS** (mutation)             | Runs the target's tests many times over. §12's premise is that scoria does not run them — the same premise that decides how coverage works. Accepting that collision comes before the open question about its runtime, and it was not accepted.                                                                                                            |
| **Playwright, axe-core, Lighthouse** | All need the application running. How to start it differs per project and may need credentials or services — things scoria cannot know. And a number from a running app moves between runs, which makes a ratchet's delta unreadable.                                                                                                                      |
| **AI review as a score**             | Non-deterministic: a judge that answers differently on identical input cannot sit under a ratchet. Costs money per run, and a tool that charges per measurement gets run less often. Needs an API key, losing the property that `npx scoria` works in any directory. The probe contract stays open for a model's findings; they just do not become points. |
| **Semgrep / CodeQL**                 | The finding intake stays open (§29). scoria does not do vulnerability analysis itself.                                                                                                                                                                                                                                                                     |
| **Cross-repository comparison**      | §3.3. Normalisation, which probes could run, and what each rubric weighs all differ. The report carries `"comparable": false` to say so, and the badge's colour is the direction of travel rather than the level.                                                                                                                                          |

## Still uncertain

Every rubric says `status: experimental` and means it. What the scales actually do was measured
across 49 repositories — see [calibration.md](calibration.md) — and that measurement changed two of
them and left the rest alone. It did not make them right, only known.
