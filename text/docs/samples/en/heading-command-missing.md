<!-- chaff-sample
rule: heading-command-missing
genre: docs/manual
file: backup-tool.md
-->

# A heading names a command its section's code does not show (`heading-command-missing`)

**Where it helps:** command-line manuals, READMEs, runbooks. Any page with a heading per command or option and an example under it.

## Original

````markdown chaff-before
# Using snapkeep

snapkeep copies a folder to a backup drive and keeps the last seven copies.

## `--exclude`

Leave out files that match a pattern. Give it once for each pattern.

```bash
snapkeep run ~/Projects --ignore "*.tmp" --ignore node_modules
```

## `--keep`

Set how many copies to keep. Older copies are deleted after each run.

```bash
snapkeep run ~/Projects --keep 14
```
````

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre docs/manual backup-tool.md

backup-tool.md   docs/manual · English   genre from --genre

─── line 5 ───────────────────────────────────────────────────

    ## `--exclude`

  ·  A heading names a command its section's code does not show

     "--exclude" in this heading does not appear in the section's code
     When the section "## `--dry-run`" shows an example using "--dryrun", the reader cannot tell which is right. It happens when a command or an option is renamed and only the heading or only the example is updated. chaff points out a heading's code part (`npm install`, `--force`, `init`) that appears in none of the code blocks or code spans of its section (up to the next heading of the same or a higher level). A section with no code at all is not checked.

     → Check which of the heading and the example has the current name, and correct the other.

     Relax this rule:  npx chaffjs relax heading-command-missing


────────────────────────────────────────────────────────────

  1 note   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

````markdown chaff-after
# Using snapkeep

snapkeep copies a folder to a backup drive and keeps the last seven copies.

## `--exclude`

Leave out files that match a pattern. Give it once for each pattern.

```bash
snapkeep run ~/Projects --exclude "*.tmp" --exclude node_modules
```

## `--keep`

Set how many copies to keep. Older copies are deleted after each run.

```bash
snapkeep run ~/Projects --keep 14
```
````

## How it was fixed

The section is headed `--exclude`, and its example uses `--ignore`.
The option was renamed in version 2, and the heading was updated while the example kept the old name.
A reader copies the example, and the backup either fails on an unknown option or, with an older version installed, works and teaches the wrong name.

The fix writes the example with the option the heading names.
chaff cannot tell which of the two is current; the writer checks against the tool's help and corrects the other.

## Settings

The rule is a note at `normal` and `relaxed`, and a warning at `strict`:

```yaml chaff-settings
rules:
  heading-command-missing: strict
```

A heading's code part (`snapkeep run`, `--exclude`, `init`) is looked for in the code blocks and code spans of its section, up to the next heading of the same or a higher level.
A section with no code, and a heading that names a file or a function (`config.yaml`, `useEffect`), are left alone.
`--force` inside `--force-with-lease` does not count as shown.

```text chaff-explain
$ npx chaffjs explain heading-command-missing --genre docs/manual

  A heading names a command its section's code does not show   (heading-command-missing)

  When the section "## `--dry-run`" shows an example using "--dryrun", the reader cannot tell which is right. It happens when a command or an option is renamed and only the heading or only the example is updated. chaff points out a heading's code part (`npm install`, `--force`, `init`) that appears in none of the code blocks or code spans of its section (up to the next heading of the same or a higher level). A section with no code at all is not checked.

  How to fix: Check which of the heading and the example has the current name, and correct the other.

  Rewrite depth: light (words and sentences; the structure and the voice stay). With a shallower chaff fix-plan --depth, the plan names this rule without fixing it.

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   warning
  → normal   note
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax heading-command-missing --why "reason"
```

[All samples](README.md)
