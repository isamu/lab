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
npx --package=/tmp/scoria-0.0.2.tgz -- scoria
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

Nothing is written when `CI=true`; the run only reports that the detection is not frozen.

## In CI

```yaml
- name: scoria
  run: npx -y scoria
```

`mode: report` is the default, so **this never fails a build**. It prints scores and findings.
Ratchet gating on regression is not implemented yet (spec §17).

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
scoria --json                  # the report as JSON
scoria --explain readability   # the breakdown, and what a fix is worth
scoria --no-write              # do not create a config file
scoria --lang ja               # Japanese terminal output
```

Terminal output is translatable; the JSON report is not. `Finding.message` stays English so that
downstream tooling reads one stable vocabulary, and the rule id joins the two.

## What it measures today

| probe              | dimension   | what it looks at                                                                                  |
| ------------------ | ----------- | ------------------------------------------------------------------------------------------------- |
| `suppression-scan` | integrity   | `as any`, `@ts-ignore`, `eslint-disable`, `it.skip`. Only the ones without a reason become errors |
| `file-shape`       | readability | p95 and maximum file length, and the count over 500 lines                                         |
| `source-mix`       | type-safety | `.js` / `.jsx` remaining in a TypeScript project                                                  |

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

External probes (eslint, knip, dependency-cruiser, jscpd), baseline and ratchet gating, tiers above
0, a GitHub Action, SARIF output, and calibration. Every threshold is provisional.

## Development

```bash
yarn format:check && yarn lint && yarn typecheck && yarn build && yarn test
```

Lint is set to the bar used by [ever-better](https://github.com/isamu/ever-better): type-aware
`typescript-eslint`, SonarJS, and `noInlineConfig`, which means `eslint-disable` cannot be written
here at all. scoria measures suppression debt; having none of its own is the point.

## License

MIT
