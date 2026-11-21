<!-- chaff-sample
rule: warning-without-action
genre: docs/manual
file: firmware-update.md
-->

# Warning that gives no action (`warning-without-action`)

**Where it helps:** manuals, setup guides, READMEs, runbooks. Anywhere a reader is about to do something that cannot be undone.

## Original

```markdown chaff-before
# Updating the printer's firmware

Download the latest firmware from the support page and copy it to a USB stick.
Put the stick in the port on the side of the printer and choose Update from the Settings menu.

Warning: the update resets the printer's network settings to their factory values.

The update takes about five minutes, and the printer restarts twice.
```

## What chaff says

```text chaff-output
$ npx chaffjs --no-guide --genre docs/manual firmware-update.md

firmware-update.md   docs/manual · English   genre from --genre

─── line 6 ───────────────────────────────────────────────────

    Warning: the update resets the printer's network settings to their factory value

  ·  Warning that gives no action

     This warning names a risk but not what the reader should do
     A warning that only names a risk ("Warning: the restore replaces the current database.") alarms the reader without saying how to avoid it. A warning in a manual says what happens and what the reader does to prevent it (export first, do not unplug the drive). A paragraph that opens with Warning, Caution or Danger is reported when none of its sentences tells the reader what to do: no "do not", "make sure", "must" and no sentence that opens with its verb ("Export today's orders first").

     → Add what the reader does to avoid the risk to the same paragraph ("Export today's orders first", "Do not unplug the drive while it runs").

     Relax this rule:  npx chaffjs relax warning-without-action


────────────────────────────────────────────────────────────

  1 note   All judged by machine
              (the same text gives the same result every time)

  The text was not changed. Fixing it is the writer's job.
```

## Corrected

```markdown chaff-after
# Updating the printer's firmware

Download the latest firmware from the support page and copy it to a USB stick.
Put the stick in the port on the side of the printer and choose Update from the Settings menu.

Warning: the update resets the printer's network settings to their factory values.
Before you start, print the network settings page from the Settings menu, so you can enter them again afterwards.

The update takes about five minutes, and the printer restarts twice.
```

## How it was fixed

The warning tells the reader that something bad will happen, and stops there.
Someone halfway through the steps now knows the network settings will be lost, but not what to do about it, and the printer may drop off the office network until someone works out the old address.

The fix adds the action to the same paragraph: print the settings page first.
A warning in a manual should always say both what happens and what the reader does to prevent it.

## Settings

The rule reads paragraphs that open with "Warning", "Caution" or "Danger", and reports one in which no sentence tells the reader what to do (no "do not", "make sure", "must", and no sentence opening with its verb).
It is a note at `normal` and `relaxed`, and a warning at `strict`:

```yaml chaff-settings
rules:
  warning-without-action: strict
```

It runs on manuals, technical documents and blogs.
Warnings inside list items, notes, tips and "Important" paragraphs are not read.

```text chaff-explain
$ npx chaffjs explain warning-without-action --genre docs/manual

  Warning that gives no action   (warning-without-action)

  A warning that only names a risk ("Warning: the restore replaces the current database.") alarms the reader without saying how to avoid it. A warning in a manual says what happens and what the reader does to prevent it (export first, do not unplug the drive). A paragraph that opens with Warning, Caution or Danger is reported when none of its sentences tells the reader what to do: no "do not", "make sure", "must" and no sentence that opens with its verb ("Export today's orders first").

  How to fix: Add what the reader does to avoid the risk to the same paragraph ("Export today's orders first", "Do not unplug the drive while it runs").

  Levels (there is no limit to count to; a level sets how a finding is marked):
    strict   warning
  → normal   note
    relaxed  note
    off      not checked

  Now: normal.

  Change it:  npx chaffjs relax warning-without-action --why "reason"
```

[All samples](README.md)
