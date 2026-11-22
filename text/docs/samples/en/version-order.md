<!-- chaff-sample
rule: version-order
genre: technical/readme
file: CHANGELOG.md
-->

# A version out of order in a changelog (`version-order`)

**Where it helps:** changelogs, release notes, lists of releases on a download page. Any list of versions kept newest first, or oldest first.

## Original

```markdown chaff-before
# Changelog

All notable changes to csvtrim are listed here, newest first.

## 2.4.0 - 2026-10-21

- Add the `--keep-empty` option.

## 2.3.1 - 2026-08-30

- Fix a crash on files that end without a newline.

## 2.5.0 - 2026-07-12

- Read files with a byte order mark.

## 2.2.0 - 2026-05-03

- Trim tabs as well as spaces.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre technical/readme CHANGELOG.md

CHANGELOG.md   technical/readme · English   genre from --genre

─── line 13 ──────────────────────────────────────────────────

    2.5.0 - 2026-07-12

  ⚠  A version out of order in a changelog

     2.5.0 breaks the order of the versions around it (after 2.3.1)
     A changelog lists its versions newest first (or oldest first). One version out of that order makes the reader mistake which release is the latest, or which change went into which release. It happens when a version is mistyped or an entry is added in the wrong place. The versions at the start of headings, list items or table rows (3.2.0, v3.2.0, [3.2.0]) are read as a sequence; its direction is taken from most of its steps, and a version that fits in no longest run along that direction is pointed out.

     → Check the version number. Correct it if it is a typo, or move the entry to where it belongs.

     Relax this rule:  npx chaffjs relax version-order


────────────────────────────────────────────────────────────

  1 warning   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Changelog

All notable changes to csvtrim are listed here, newest first.

## 2.4.0 - 2026-10-21

- Add the `--keep-empty` option.

## 2.3.1 - 2026-08-30

- Fix a crash on files that end without a newline.

## 2.3.0 - 2026-07-12

- Read files with a byte order mark.

## 2.2.0 - 2026-05-03

- Trim tabs as well as spaces.
```

## How it was fixed

The changelog runs newest first, and its dates agree: October, August, July, May.
But the July entry is numbered 2.5.0, higher than the 2.4.0 at the top.
A user who reads the headings alone will think 2.5.0 is the latest release, look for it on npm and not find it, or wonder whether 2.4.0 lost the byte order mark fix.

The July release was 2.3.0, and the 5 was a slip of the finger.
The fix corrects the number, so the versions fall in step with the dates.
If an entry is in the wrong place instead, move it to where it belongs.

## Settings

A version out of order is a warning at the default level; `strict` makes it an error and `relaxed` a note:

```yaml chaff-settings
rules:
  version-order: relaxed
```

To stop checking it, write `off` instead of `relaxed`.

Versions in three dotted parts (3.2.0, v3.2.0, [3.2.0]) at the start of headings, list items or table rows are read as one sequence.
Its direction is taken from most of its steps, so a changelog may run either way.
Fewer than three versions, versions in running text and examples in code blocks are not checked.
The rule does not run in legal, academic or literature writing, or in speech transcripts.

```text chaff-explain
$ npx chaffjs explain version-order --genre technical/readme

  A version out of order in a changelog   (version-order)

  A changelog lists its versions newest first (or oldest first). One version out of that order makes the reader mistake which release is the latest, or which change went into which release. It happens when a version is mistyped or an entry is added in the wrong place. The versions at the start of headings, list items or table rows (3.2.0, v3.2.0, [3.2.0]) are read as a sequence; its direction is taken from most of its steps, and a version that fits in no longest run along that direction is pointed out.

  How to fix: Check the version number. Correct it if it is a typo, or move the entry to where it belongs.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   error
  → normal   warning
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax version-order --why "reason"
```

[All samples](README.md)
