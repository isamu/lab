# CLAUDE.md — chaff

Notes for an AI working on chaff. The user-facing documentation is `README.md` and the site
(https://isamu.github.io/lab/, source in `site/`).

## What chaff is for

**A mistake in a document is caught by a machine.** chaff checks any business document — a contract, a
statute, a manual, a travel itinerary, a report — deterministically: the same text gives the same result every
time. It never rewrites anything; fixing is the writer's job.

**chaff is the machine half; the AI is the other half.** An AI reads and writes documents; chaff checks what
can be checked without judgement: readability (lint), structure (a missing article, a gap in the numbering, a
term defined twice), quotations (`cite`: is this quote really at that address), and — where it is heading —
consistency and arithmetic (dates in order, totals that add up). The point is that **an AI's mistake is caught
mechanically**, not by another AI's opinion. Where only reading can decide, chaff stops at narrowing the
question (`chaff test` sends only the passages that need a judge).

**The checks themselves are maintained and evolved by AI.** Real documents and users' feedback show where chaff
is wrong (a false positive) or blind (a miss). Each one becomes a test and a fix. This loop is how chaff gets
better, and it is the normal way to work here:

1. Run chaff on real documents — the corpus (`yarn corpus:fetch`; public-domain statutes are committed, other
   documents stay in a local cache) or a user's report.
2. For every finding that is wrong, find the pattern, not the instance: which other documents take the same path.
3. Put a minimal real excerpt in a test (public-domain text only), watch it fail, fix, watch it pass.
4. Re-run the corpus and confirm nothing else moved.

The direction is tracked in isamu/lab#130.

## Principles that decide design questions

- **Machine judgement only in chaff.** No model inside the lint path. Anything that needs meaning goes through
  `chaff test`, which says what it sends before it sends it.
- **Say why a rule did not run.** "0 findings" must never be mistaken for "checked and fine": every rule that
  could not run is listed with its reason.
- **Take no side on style.** Where two ways are both right (spacing, contractions, capitalisation), chaff only
  checks that one document is consistent, and points at the minority.
- **The team decides its own words.** Jargon, required sections and preferred spellings come from `chaff.yaml`;
  chaff ships none of its own.
- **Japanese and English both work, fully.** A rule, a message and every screen exist in both. The screen
  follows the document's language; other output follows `chaff.yaml`'s `language`, then the locale.
- **A rule is data.** `packages/chaff/rules/*.yaml` holds names, reasons, messages, levels in both languages; the
  site's rule reference is built from these files.

## Working here

- `yarn format`, `yarn lint`, `yarn lint:oxlint`, `yarn typecheck`, `yarn build`, `yarn test` (node:test,
  `test/test_*.ts`; `CHAFF_TEST_JOBS=4 yarn test` caps the processes when several checkouts share a machine).
- `yarn corpus`, `yarn bench` and `yarn planted` compare findings with committed expectations (`--update` accepts a
  change). `yarn rules:measure --apply` places a new or changed rule, over the documents pinned in
  `corpus/rules-measure-documents.json`. `yarn screens:update` regenerates the guide's screens.
- A change that claims Japanese output is unchanged is proved by diffing the old and new builds over many
  commands, not by reading.
- Tests use only public-domain or self-written text. Never commit a document that may not be redistributed.
- Releases: `docs/ChangeLog.md` is written at release from the merged PRs' titles; a PR does not edit it.
  `npm publish` is run by the maintainer.

## How to work here (methods that proved themselves)

- **Planted sets per genre** (`test/fixtures/planted/`, `yarn planted`): a clean and a planted version, recall
  recorded per kind, CI fails on a drop. This found real gaps (contracts). Extend a set before fixing a miss.
- **Place rules by measurement** on the pinned human corpus (`yarn rules:measure --apply`), not by hand. Retune a
  limit rather than turn a core rule off.
- **A rule touches only its own files**: its YAML (with `off_for`), its registry file, its own expectations and
  plants, the generated guide screens. Shared hand-edited lists caused most merge conflicts.
- **Small PRs, landed as soon as CI is green.** Parallel agents split by rule and file, never two in one file.
- **Light local checks:** `yarn typecheck`, the changed test files (`node --test test/test_<name>.ts`), and
  `yarn corpus` + `yarn planted` for a rule change. CI runs lint and the full sharded suite.
- **Read every new corpus finding before accepting it.** Narrow a rule rather than accept a false positive.
- **Behaviour-preserving changes:** run old and new side by side over generated and corpus inputs.
- **After a release:** install the published package in a fresh folder and run it on a real sentence; that caught
  misses the tests did not.
