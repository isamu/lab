# Using scoria

A guide for someone who has just heard of it. The
[README](../packages/scoria/README.md) is the reference; this is the walkthrough.

## What it is

scoria reads a TypeScript or JavaScript repository and tells you what shape it is in — how readable
it is, what it is missing, where it is coming apart — as nine numbers with the evidence behind each
one.

It is for code that was written fast. Code written by an LLM, or by a person in a hurry, rots in
particular ways: one file grows to two thousand lines, an error gets silenced instead of fixed, a
module is written twice because nobody remembered the first one. Those are the things scoria
counts.

**It brings its own standards.** It does not read your ESLint config and grade you against it,
because a project that has turned every rule off would score perfectly. The rules come with scoria.

## Try it

You need nothing installed. In any repository:

```bash
npx scoria
```

About twenty seconds later:

```text
my-project  [vue · react · ts]  profile: library
17 files · 1095 sloc · 619 test sloc   config: detected

  Dimension            Score   Confidence
  ──────────────────────────────────────────────────────────────
  architecture             —   high   only 0% of this dimension could be measured
  correctness             95   high
  documentation          100   high   only 75% of this dimension could be measured
  integrity               80   high
  readability             90   high
  security                86   high
  test-coverage          100   high   only 30% of this dimension could be measured
  type-safety             86   high   only 50% of this dimension could be measured
  ui-consistency           —   high   only 0% of this dimension could be measured
  ──────────────────────────────────────────────────────────────
  Overall                 91   not comparable across repos (mean of 7)
```

That is a real first run, and the interesting part of it is the right-hand column.

## Reading it

### `—` means nobody looked

A dash is not zero. It means nothing in that dimension could be measured, so scoria refuses to put
a number there. Above, `architecture` is a dash because the project's dependencies are not
installed and the tools that trace imports had nothing to trace. `ui-consistency` is a dash because
there are no components.

This matters more than it sounds. An earlier version scored an empty directory 90 out of 100,
because "no problems found" and "nothing looked at" produced the same number. They are not the same
thing and the report does not pretend they are.

### "only N% could be measured"

The same idea, one level down. `type-safety` says 86, and then says only half of it was measured —
the half that counts untyped files. The other half runs the TypeScript compiler, and that needs the
project installed. **86 out of the half that was looked at** is a different claim from 86.

### `Overall … (mean of 7)`

Nine dimensions are listed and seven were scored, so the average is of seven. The count is there so
that an average of a few does not look like an average of all.

### Confidence

`high` is the normal case. Anything lower means the dimension was measured through a lot of
silenced errors — `as any`, `@ts-ignore`, `eslint-disable` — and the number is as much about the
silencing as about the code. **Read the confidence before the score.**

## What it reads

### The files

It walks the directory you point it at and **never leaves it**. Along the way it skips, by name:

```text
node_modules   .git   dist   lib   build   coverage   .next   out   .turbo   .output
```

and every directory whose name begins with a dot. What is left is sorted into four kinds:

| kind      | what it is                                                                                                | counted as                    |
| --------- | --------------------------------------------------------------------------------------------------------- | ----------------------------- |
| source    | `.ts` `.tsx` `.mts` `.cts` `.js` `.jsx` `.mjs` `.cjs`, and `.vue`                                         | the code being judged         |
| test      | anything under `test/ tests/ __tests__/ __mocks__/ e2e/ spec/`, or named `*.test.*`, `*.spec.*`, `test_*` | the tests, weighed separately |
| config    | `*.config.ts`, `*.config.js`, `eslint.config.*`, `vite.config.*`, and friends                             | neither                       |
| generated | `*.d.ts`, `*.min.js`                                                                                      | neither                       |

Anything else — Markdown, JSON, images, CSS — is not read as code. A file over 2 MB is skipped.

For a `.vue` file only the `<script>` block is treated as code; the template and styles are read
separately, by the UI check, which is the one place a colour in a template matters.

### The settings

It also looks for these at the root, and reads them to see what the project holds itself to:

```text
package.json   tsconfig.json   jsconfig.json   eslint.config.*   .eslintrc*
.prettierrc*   .gitignore   knip.json   vitest.config.ts   jest.config.js
```

and for `.github/workflows/*.yml` — climbing up to four directories if the workflows live above
the one being measured, as they do in a monorepo.

Reading them is not the same as being graded by them. `tsconfig.json` is passed to the TypeScript
compiler because type checking has to use the project's own settings. The rest is read to ask a
different question: **does this project have gates, and does CI run them?** A repository with no
lint config and no CI scores badly for that, whatever its lint config would have said.

### What each part is looked at for

| what it reads                                   | what it asks                                                                                     |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| every source file                               | how big the files are, how much is duplicated, how much is untyped, how many errors are silenced |
| the same files, comments only                   | markers left behind: TODO, FIXME, XXX, HACK                                                      |
| `.vue` `.tsx` `.jsx`, whole                     | how many distinct colours and spacing values, inline styles, style blocks                        |
| test files                                      | how much test code there is, against the code it covers                                          |
| `tsconfig.json` + your installed TypeScript     | type errors                                                                                      |
| your lockfile + your package manager            | known advisories                                                                                 |
| the import graph                                | files and exports nothing reaches, modules importing in circles                                  |
| `README.md`                                     | whether it exists, how much it says, whether it lists the flags the code accepts                 |
| config files and workflows                      | whether the project's own gates exist and whether CI runs them                                   |
| `coverage/lcov.info` or `coverage-summary.json` | coverage, if the project already made a report                                                   |

## Getting the whole picture

The first run above measured seven of nine. Two commands change that:

```bash
npm install          # or yarn — lets tsc, knip and the circular-import check run
npm test -- --coverage   # whatever your project's coverage command is
npx scoria
```

scoria never runs your tests. A test suite can take minutes, touch a database or need credentials,
and a tool that sets all that off because you asked it for a number is one you will not run twice.
It reads a coverage report if your project already made one — `coverage/lcov.info` or
`coverage/coverage-summary.json` — and says it is skipping if not.

## Watching it change

A single score says little. The point is the direction.

```bash
npx scoria baseline       # records this run
git add .scoria/baseline.json
```

From then on, every run reports what moved:

```text
What moved
    -30.0  integrity      suppression-scan.source_per_kloc   0 → 975
    -20.0  integrity      suppression-scan.unreasoned_ratio  0 → 1
```

Each line names the metric that moved and what it cost. Upgrading a linter adds rules and the score
falls — that is not a regression, and scoria says so rather than reporting decay, because it
records the tool versions in the baseline too.

## In CI

```yaml
- run: npx -y scoria --sarif scoria.sarif

- uses: github/codeql-action/upload-sarif@v4
  with:
    sarif_file: scoria.sarif
    category: scoria
  # needs: permissions: security-events: write
```

Two things happen. The run's **job summary** gets a bar chart and a table, on the page a reviewer is
already looking at. And each finding lands on GitHub's **Security tab** and inline on the changed
lines of the pull request — where the person who wrote the line is looking.

## Failing the build

By default scoria gates nothing: it reports and exits 0. A tool that turns CI red on the day it is
installed is one nobody keeps. Once the baseline has settled:

```json
{ "mode": "ratchet" }
```

Now the run exits 1 when a dimension falls, when an unexplained suppression is added, or when a new
error-level finding appears.

**What it refuses to fail on matters as much.** Three kinds of regression are reported and not
gated: a dimension whose confidence is low, one whose tool changed version, and size-normalised
metrics when the repository changed size sharply. They are printed under _Regressed, but not
gated_ — a regression quietly excluded would be indistinguishable from no regression.

## More than one project in the repository

scoria measures one directory and does not wander below it, because the tools it drives are each
rooted in one place: `tsc` reads one tsconfig, `audit` reads one lockfile. Point it at a repository
holding two projects and it will see the outer one while counting the files of both.

So name them:

```json
{ "targets": [".", "functions"] }
{ "targets": ["packages/*", "agents/*"] }
```

Each is measured as though scoria had been run inside it. If your repository has a
[`repo.json`](https://github.com/repos-json/repos-json), its `projects` field does the same job and
scoria reads it without further configuration.

This is not hypothetical. One real project keeps a Vue app at the repository root and Firebase
functions in a subdirectory with their own lockfile. Measured from the root, the type checker
reported zero errors without ever looking at the functions' 93 files, and the audit missed four
high-severity advisories.

## What the number is not

**It is not comparable with anyone else's.** Which probes could run, what each rubric weighs and
what normalises all differ between repositories. A 72 here and a 64 there does not mean the first is
better. The report says so in its own JSON — `"comparable": false` — and the badge, if you use one,
carries `this repo only` in its text and takes its colour from the direction of travel rather than
the level.

**It is not calibrated.** Every scale still says `experimental` and means it. They were measured
across 49 real repositories to find out what they actually do — that work is written up in
[calibration.md](calibration.md), and it corrected two of them — but knowing what a scale does is
not the same as knowing it is right.

So: use the trend, argue with the findings, and treat the absolute number as a rough sketch.

## When it does not run

### `Cannot read <path>`

The directory is not there, or the path is wrong. scoria never leaves the directory it is pointed
at, so a relative path is relative to where you are standing.

### It printed a report, but half of it says `—`

That is not an error. Dependencies are not installed, so the checks that trace imports and run the
type checker had nothing to work with. `npm install` and run it again.

### `No directory matched …`

A `targets` glob matched nothing. The patterns are literal directory names or a segment that is
exactly `*` — `packages/*` works, `packages/we*` and `**/src` are not supported and are reported
rather than guessed at. Exits 1, on purpose: measuring zero directories and reporting success is
the one outcome nobody notices is wrong.

### A check says "skipped"

Every skipped check prints its reason under **probes not scored**, and the reasons are mundane:

| it says                                      | do this                                                       |
| -------------------------------------------- | ------------------------------------------------------------- |
| the project's dependencies are not installed | `npm install`                                                 |
| the project has no installed typescript      | install it, or accept that type errors go unchecked           |
| no lockfile to audit                         | there is nothing to audit against                             |
| no coverage report                           | run your tests with coverage first, if you want that measured |
| no `.vue`, `.tsx` or `.jsx` files            | there is no UI to be consistent about                         |

A skipped check is excluded from the score rather than counted as zero, and the dimension says how
much of it was measured.

### It left a `scoria.config.json` behind

It writes one on the first run in a directory with no config, recording what it detected so later
runs measure the same way. If you were only trying it out, delete the file — or pass `--no-write`,
which never creates one.

### It is slow, or it hangs

The first `npx scoria` downloads the package; twenty to thirty seconds is normal. After that a
small repository takes a second or two and a large one under a minute. If it stalls much longer,
the cause is almost always one of the tools it drives on a very large tree — try `--json` to see
which checks completed, and each check has a two-minute ceiling of its own.

### It crashed with something else

That is a bug, and worth reporting with the output. A measurement tool that falls over is annoying;
one that reports something untrue is worse, so both are worth hearing about.

## When something looks wrong

It might be. A measurement that reports something untrue is the worst thing this tool can do, and
several have been found and fixed by someone reading the output and saying "that is not right".

If a finding is a false positive, or a score moves for a reason that is not about your code, that is
worth reporting — with the output and the repository shape that produced it.
